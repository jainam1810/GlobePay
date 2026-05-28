export const DISPERSE_ADDRESS = (process.env.NEXT_PUBLIC_DISPERSE_ADDRESS ?? "") as `0x${string}`;

export const disperseAbi = [
    {
        type: "function",
        name: "disperseToken",
        stateMutability: "nonpayable",
        inputs: [
            { name: "token", type: "address" },
            { name: "recipients", type: "address[]" },
            { name: "amounts", type: "uint256[]" },
        ],
        outputs: [],
    },
] as const;