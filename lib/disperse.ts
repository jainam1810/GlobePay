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
    {
        type: "event",
        name: "Dispersed",
        inputs: [
            { name: "token", type: "address", indexed: true },
            { name: "sender", type: "address", indexed: true },
            { name: "totalRecipients", type: "uint256", indexed: false },
            { name: "totalAmount", type: "uint256", indexed: false },
        ],
    },
] as const;