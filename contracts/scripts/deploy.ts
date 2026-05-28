import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    const balance = await ethers.provider.getBalance(deployer.address);

    console.log("Deploying with:", deployer.address);
    console.log("Balance:", ethers.formatEther(balance), "ETH");

    const Disperse = await ethers.getContractFactory("Disperse");
    const disperse = await Disperse.deploy();
    await disperse.waitForDeployment();

    const address = await disperse.getAddress();
    console.log("\nDisperse deployed to:", address);
    console.log("\nNext:");
    console.log("  Verify:        npx hardhat verify --network baseSepolia", address);
    console.log("  .env.local:    NEXT_PUBLIC_DISPERSE_ADDRESS=" + address);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });