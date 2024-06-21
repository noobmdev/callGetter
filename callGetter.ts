import { TonClient, WalletContractV4, toNano } from "@ton/ton";
import { mnemonicToWalletKey, mnemonicNew } from "@ton/crypto";

import {
	Contract,
	ContractProvider,
	Sender,
	Address,
	Cell,
	contractAddress,
	beginCell,
	Builder,
	Slice,
} from "@ton/core";

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

require("dotenv").config();

// address link: https://tonviewer.com/EQBjZf-UZaz6YQTkHJ3EBxJpgh6GROxoecRm3vVNcncwHNy9
// testnet https://testnet.tonscan.org/address/EQCDcTg5lRpYA79ZblrWnKJMhZB0WCvw6XGN9Qtn7dq1CRGa
const counterAddress = Address.parse(
	"EQCDcTg5lRpYA79ZblrWnKJMhZB0WCvw6XGN9Qtn7dq1CRGa"
);

// create ton client
const client = new TonClient({
	endpoint: process.env.TON_CENTER_ENDPOINT!,
	apiKey: process.env.TON_CENTER_API_KEY,
});

export type Add = {
	$$type: "Add";
	amount: bigint;
};

export function storeAdd(src: Add) {
	return (builder: Builder) => {
		let b_0 = builder;
		b_0.storeUint(2278832834, 32);
		b_0.storeUint(src.amount, 32);
	};
}

class Counter implements Contract {
	static createForDeploy(code: Cell, initialCounterValue: number): Counter {
		const data = beginCell().storeUint(initialCounterValue, 64).endCell();
		const workchain = 0; // deploy to workchain 0
		const address = contractAddress(workchain, { code, data });
		return new Counter(address, { code, data });
	}

	constructor(
		readonly address: Address,
		readonly init?: { code: Cell; data: Cell }
	) {}

	async send(
		provider: ContractProvider,
		via: Sender,
		args: { value: bigint; bounce?: boolean | null | undefined },
		message: Add | "increment"
	) {
		let body: Cell | null = null;
		if (
			message &&
			typeof message === "object" &&
			!(message instanceof Slice) &&
			message.$$type === "Add"
		) {
			body = beginCell().store(storeAdd(message)).endCell();
		}
		if (message === "increment") {
			body = beginCell().storeUint(0, 32).storeStringTail(message).endCell();
		}
		if (body === null) {
			throw new Error("Invalid message type");
		}

		await provider.internal(via, { ...args, body: body });
	}

	async getCounter(provider: ContractProvider) {
		const { stack } = await provider.get("counter", []);
		return stack.readBigNumber();
	}
}

// Needs rpc endpoint
async function callCounter() {
	/* 
    Add ton client code to call counter. It should return 1

    console.log to print the result

    */

	const counter = new Counter(counterAddress);
	const counterContract = client.open(counter);

	// call the getter on chain
	const counterValue = await counterContract.getCounter();
	console.log("Counter: ", counterValue);
	return counterValue;
}

async function incrementCounter() {
	try {
		let keyPair = await mnemonicToWalletKey(
			process.env.WALLET_MNEMONIC!.split(" ")
		);

		let workchain = 0; // Usually you need a workchain 0
		let wallet = WalletContractV4.create({
			workchain,
			publicKey: keyPair.publicKey,
		});

		if (!(await client.isContractDeployed(wallet.address))) {
			return console.log("wallet is not deployed");
		}
		const walletContract = client.open(wallet);
		const walletSender = walletContract.sender(keyPair.secretKey);

		/* 
    Add ton client code to send 'increment' to the contract
    */

		// const counter = await client.(counterAddress, "counter");
		// console.log("Counter: ", counter.stack.readBigNumber());

		console.log("Set counter");
		const counter = new Counter(counterAddress);
		const counterContract = client.open(counter);

		let counterBefore = await callCounter();

		// send the increment transaction
		await counterContract.send(
			walletSender,
			{
				value: toNano("0.05"),
			},
			{
				$$type: "Add",
				amount: 10n, // Change any number
			}
		);

		let counterAfter = await callCounter();
		let attempt = 1;
		while (counterAfter === counterBefore) {
			console.log(`Attempt ${attempt}`);
			await sleep(2000);
			counterAfter = await callCounter();
			attempt++;
		}
	} catch (error) {
		console.error(error);
	}
}

callCounter();
incrementCounter();
