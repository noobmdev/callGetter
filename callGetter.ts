import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToWalletKey, mnemonicNew } from "@ton/crypto";

import {
	Contract,
	ContractProvider,
	Sender,
	Address,
	Cell,
	contractAddress,
	beginCell,
} from "@ton/core";

require("dotenv").config();

// address link: https://tonviewer.com/EQBjZf-UZaz6YQTkHJ3EBxJpgh6GROxoecRm3vVNcncwHNy9
const counterAddress = Address.parse(
	"EQBjZf-UZaz6YQTkHJ3EBxJpgh6GROxoecRm3vVNcncwHNy9"
);

// create ton client
const client = new TonClient({
	endpoint: process.env.TON_CENTER_ENDPOINT!,
	apiKey: process.env.TON_CENTER_API_KEY,
});

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

	async sendDeploy(provider: ContractProvider, via: Sender) {
		await provider.internal(via, {
			value: "0.01", // send 0.01 TON to contract for rent
			bounce: false,
		});
	}

	async sendIncrement(provider: ContractProvider, via: Sender) {
		const messageBody = beginCell()
			.storeUint(1, 32) // op (op #1 = increment)
			.storeUint(0, 64) // query id
			.endCell();
		await provider.internal(via, {
			value: "0.002", // send 0.002 TON for gas
			body: messageBody,
		});
	}

	async getCounter(provider: ContractProvider) {
		const { stack } = await provider.get("counter", []);
		return stack.readBigNumber();
	}
}

// Needs rpc endpoint
async function callCounter() {
	try {
		/* 
    Add ton client code to call counter. It should return 1

    console.log to print the result

    */

		const counter = new Counter(counterAddress);
		const counterContract = client.open(counter);

		// call the getter on chain
		const counterValue = await counterContract.getCounter();
		console.log("Counter: ", counterValue);
	} catch (error) {
		console.error(error);
	}
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

		const counter = new Counter(counterAddress);
		const counterContract = client.open(counter);

		// send the increment transaction
		await counterContract.sendIncrement(walletSender);
	} catch (error) {
		console.error(error);
	}
}

callCounter();
incrementCounter();
