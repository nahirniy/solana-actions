import express from "express";
import cors from "cors";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createPostResponse } from "@solana/actions";

const DEFAULT_SOL_ADDRESS = new PublicKey("5jZ8KE9B2i1svQ7jRK6geRTMEWLKT22cAyd7T33ohVWq");
const DEFAULT_SOL_AMOUNT = 1;
const connection = new Connection(clusterApiUrl("devnet"));

const PORT = 8080;
const BASE_URL = `http://localhost:${PORT}`;

const app = express();
app.use(express.static("public"));
app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Content-Encoding", "Accept-Encoding"],
    })
);
app.get("/", (req, res) => res.send("hi"));
app.get("/actions.json", getActionsJson);
app.get("/api/actions/transfer-sol", getTransferSol);
app.post("/api/actions/transfer-sol", postTransferSol);

// Route handlers
function getActionsJson(req, res) {
    const payload = {
        rules: [
            { pathPattern: "/*", apiPath: "/api/actions/*" },
            { pathPattern: "/api/actions/**", apiPath: "/api/actions/**" },
        ],
    };
    res.json(payload);
}

async function getTransferSol(req, res) {
    try {
        const { toPubkey } = validatedQueryParams(req.query);
        const protocol = req.protocol;
        const host = req.get("host");
        const baseHref = `${protocol}://${host}/api/actions/transfer-sol?to=${toPubkey.toBase58()}`;

        const payload = {
            title: "Transfer SOL to Dexola! 😘",
            icon: `https://solana-actions.vercel.app/solana_devs.jpg`,
            description: "Dexola need more SOL for build better project",
            links: {
                actions: [
                    { label: "Send 1 SOL", href: `${baseHref}&amount=1` },
                    { label: "Send 5 SOL", href: `${baseHref}&amount=5` },
                    { label: "Send 10 SOL", href: `${baseHref}&amount=10` },
                    {
                        label: "Send SOL",
                        href: `${baseHref}&amount={amount}`,
                        parameters: [{ name: "amount", label: "Enter the amount of SOL to send", required: true }],
                    },
                ],
            },
        };

        res.json(payload);
    } catch (err) {
        console.log(err);
    }
}

async function postTransferSol(req, res) {
    try {
        const { amount, toPubkey } = validatedQueryParams(req.query);
        const { account } = req.body;

        if (!account) {
            throw new Error('Invalid "account" provided');
        }

        const fromPubkey = new PublicKey(account);
        const minimumBalance = await connection.getMinimumBalanceForRentExemption(0);

        if (amount * LAMPORTS_PER_SOL < minimumBalance) {
            throw new Error(`Account may not be rent exempt: ${toPubkey.toBase58()}`);
        }

        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

        const transaction = new Transaction({
            feePayer: fromPubkey,
            blockhash,
            lastValidBlockHeight,
        }).add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey,
                lamports: amount * LAMPORTS_PER_SOL,
            })
        );

        const payload = await createPostResponse({
            fields: {
                transaction,
                message: `Send ${amount} SOL to ${toPubkey.toBase58()}`,
            },
            // note: no additional signers are needed
            // signers: [],
        });

        res.json(payload);
    } catch (err) {
        res.status(400).json({ error: err.message || "An unknown error occurred" });
    }
}

function validatedQueryParams(query) {
    let toPubkey = DEFAULT_SOL_ADDRESS;
    let amount = DEFAULT_SOL_AMOUNT;

    if (query.to) {
        try {
            toPubkey = new PublicKey(query.to);
        } catch (err) {
            throw new Error("Invalid input query parameter: to");
        }
    }

    try {
        if (query.amount) {
            amount = parseFloat(query.amount);
        }
        if (amount <= 0) throw new Error("amount is too small");
    } catch (err) {
        throw new Error("Invalid input query parameter: amount");
    }

    return { amount, toPubkey };
}

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
