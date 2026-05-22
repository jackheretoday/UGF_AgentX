const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
    PageBreak, LevelFormat, PageOrientation
  } = require('docx');
  const fs = require('fs');
  
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  
  const accentBorder = { style: BorderStyle.SINGLE, size: 1, color: "4F46E5" };
  const accentBorders = { top: accentBorder, bottom: accentBorder, left: accentBorder, right: accentBorder };
  
  const cellMargins = { top: 100, bottom: 100, left: 150, right: 150 };
  
  function h1(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text, bold: true, size: 36, color: "1E1B4B" })]
    });
  }
  
  function h2(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 300, after: 160 },
      children: [new TextRun({ text, bold: true, size: 28, color: "4F46E5" })]
    });
  }
  
  function h3(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 200, after: 120 },
      children: [new TextRun({ text, bold: true, size: 24, color: "374151" })]
    });
  }
  
  function para(text, opts = {}) {
    return new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text, size: 22, color: opts.color || "1F2937", bold: opts.bold || false })]
    });
  }
  
  function bullet(text) {
    return new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, size: 22, color: "1F2937" })]
    });
  }
  
  function divider() {
    return new Paragraph({
      spacing: { before: 200, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "E5E7EB", space: 1 } },
      children: [new TextRun("")]
    });
  }
  
  function pageBreak() {
    return new Paragraph({ children: [new PageBreak()] });
  }
  
  function twoColTable(col1Header, col2Header, rows, col1Width = 3200, col2Width = 6160) {
    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [col1Width, col2Width],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: accentBorders,
              width: { size: col1Width, type: WidthType.DXA },
              shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: col1Header, bold: true, size: 20, color: "4F46E5" })] })]
            }),
            new TableCell({
              borders: accentBorders,
              width: { size: col2Width, type: WidthType.DXA },
              shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: col2Header, bold: true, size: 20, color: "4F46E5" })] })]
            })
          ]
        }),
        ...rows.map(([c1, c2]) => new TableRow({
          children: [
            new TableCell({
              borders,
              width: { size: col1Width, type: WidthType.DXA },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: c1, size: 20, bold: true, color: "1F2937" })] })]
            }),
            new TableCell({
              borders,
              width: { size: col2Width, type: WidthType.DXA },
              margins: cellMargins,
              children: [new Paragraph({ children: [new TextRun({ text: c2, size: 20, color: "374151" })] })]
            })
          ]
        }))
      ]
    });
  }
  
  function threeColTable(h1t, h2t, h3t, rows, w1 = 2400, w2 = 3000, w3 = 3960) {
    return new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [w1, w2, w3],
      rows: [
        new TableRow({
          children: [h1t, h2t, h3t].map((h, i) => new TableCell({
            borders: accentBorders,
            width: { size: [w1, w2, w3][i], type: WidthType.DXA },
            shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
          }))
        }),
        ...rows.map(row => new TableRow({
          children: row.map((cell, i) => new TableCell({
            borders,
            width: { size: [w1, w2, w3][i], type: WidthType.DXA },
            margins: cellMargins,
            children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151" })] })]
          }))
        }))
      ]
    });
  }
  
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } }
          }]
        }
      ]
    },
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 28, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 24, bold: true, font: "Arial" },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ]
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
  
        // ── COVER ──────────────────────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1440, after: 400 },
          children: [new TextRun({ text: "UGF AgentX", bold: true, size: 72, color: "4F46E5" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "AI-Powered Gasless Blockchain Assistant", size: 36, color: "374151" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Universal Gas Framework Hackathon — Base Sepolia", size: 24, color: "6B7280", italics: true })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 600 },
          children: [new TextRun({ text: "Complete PPT Reference Document", size: 22, color: "9CA3AF" })]
        }),
        divider(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 120 },
          children: [new TextRun({ text: "For use by presentation and design team", size: 20, color: "6B7280" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 1440 },
          children: [new TextRun({ text: "May 2026", size: 20, color: "9CA3AF" })]
        }),
  
        pageBreak(),
  
        // ── SECTION 1: PROJECT OVERVIEW ──────────────────────────
        h1("1. Project Overview"),
        para("UGF AgentX is a beginner-friendly, AI-powered Web3 assistant built on Base Sepolia testnet. It lets users perform real blockchain actions — minting NFT badges, claiming certificates, donating, and sending rewards — simply by typing natural language commands in a chat interface."),
        para(""),
        para("The core innovation: users never need ETH to pay gas fees. The Universal Gas Framework (UGF) handles all gas payments invisibly, using Mock USD instead of ETH. The result is a Web3 experience that feels like a familiar chat app.", { color: "4F46E5", bold: true }),
        para(""),
        h2("1.1 The Problem We Solve"),
        para("Every blockchain action on Ethereum requires ETH for gas fees. This creates a massive barrier for new users who:"),
        bullet("Don't know what ETH is or why they need it"),
        bullet("Don't have ETH in their wallet"),
        bullet("Get blocked right at the moment of action and give up"),
        bullet("Never onboard into Web3 as a result"),
        para(""),
        h2("1.2 Our Solution"),
        para("UGF AgentX makes this wall disappear. A user types 'Mint badge for Jay', pays a small amount in Mock USD, and UGF executes the blockchain transaction — paying ETH gas from its own server-side vault. The user never sees the word ETH."),
        para(""),
        h2("1.3 One-Line USP"),
        new Paragraph({
          spacing: { before: 160, after: 160 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: "4F46E5", space: 10 }
          },
          indent: { left: 360 },
          children: [new TextRun({ text: '"Do things on-chain. Pay in dollars. Never think about ETH."', bold: true, size: 26, color: "1E1B4B", italics: true })]
        }),
        para(""),
        h2("1.4 Hackathon Track"),
        twoColTable("Field", "Value", [
          ["Hackathon", "UGF x TychiLabs Hackathon"],
          ["Track", "Minting — NFT badges, certificates, rewards"],
          ["Network", "Base Sepolia (Ethereum L2 testnet)"],
          ["Gas payment", "Mock USD via UGF (no ETH required)"],
          ["Primary SDK", "@tychilabs/ugf-testnet-js"],
          ["Demo type", "Full-stack dApp with AI chat interface"],
        ]),
  
        pageBreak(),
  
        // ── SECTION 2: WHAT IS UGF ──────────────────────────────
        h1("2. What Is UGF (Universal Gas Framework)?"),
        para("UGF is an execution layer for remote transactions. It lets users and AI agents act on any blockchain without depending on each chain's gas token."),
        para(""),
        h2("2.1 How UGF Works (Simple Explanation)"),
        para("Think of UGF like a currency exchange at the airport — you hand over your currency (Mock USD), they handle the local currency (ETH gas) for you, and you get to your destination without worrying about exchange rates or wallets."),
        para(""),
        h2("2.2 The 4-Step UGF Flow"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1600, 1800, 5960],
          rows: [
            new TableRow({
              children: ["Step", "Name", "What happens"].map((h, i) => new TableCell({
                borders: accentBorders,
                width: { size: [1600, 1800, 5960][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["1", "Quote", "UGF calculates how much Mock USD the gas will cost"],
              ["2", "Settle", "Mock USD is deducted from the user's balance"],
              ["3", "Execute", "UGF pays ETH gas itself and submits the transaction on-chain"],
              ["4", "Confirm", "Transaction confirmed on Base Sepolia; tx hash returned"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders,
                width: { size: [1600, 1800, 5960][i], type: WidthType.DXA },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 1 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("2.3 Why UGF vs Other Solutions"),
        threeColTable("Approach", "Complexity", "Our Approach", [
          ["ERC-4337 / Account Abstraction", "Paymasters + Bundlers + complex setup", "UGF — none of this needed"],
          ["Relay services", "Custom infrastructure", "UGF handles it all"],
          ["User funds ETH manually", "User must buy ETH, bridge, configure gas", "UGF — user pays USD only"],
          ["UGF (our choice)", "Quote → Settle → Execute → Confirm", "Simple 4-step SDK call"],
        ]),
  
        pageBreak(),
  
        // ── SECTION 3: WHAT AGENTX DOES ──────────────────────────
        h1("3. What UGF AgentX Does"),
        para("AgentX is the application built on top of UGF. It is an AI chat assistant where users type natural language blockchain commands and the app handles everything else."),
        para(""),
        h2("3.1 Supported Commands (Intents)"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2200, 3000, 4160],
          rows: [
            new TableRow({
              children: ["Intent", "Example command", "What happens on-chain"].map((h, i) => new TableCell({
                borders: accentBorders,
                width: { size: [2200, 3000, 4160][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["MINT_BADGE", '"Mint blockchain innovator badge for Jay"', "ERC-721 NFT minted to recipient"],
              ["CLAIM_CERT", '"Claim workshop certificate"', "ERC-721 certificate minted to user wallet"],
              ["DONATE", '"Donate 5 USD to the cause"', "donate() called on contract"],
              ["SEND_REWARD", '"Send blockchain reward to Rahul"', "mintBadge() called with reward metadata"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders,
                width: { size: [2200, 3000, 4160][i], type: WidthType.DXA },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("3.2 Judge Demo Flow (Exact Steps)"),
        para("This is the exact flow a judge sees during the live demo:"),
        bullet("Step 1: User opens the app — sees a dark AI chat interface"),
        bullet("Step 2: Wallet panel shows ETH balance = 0.0000 (no ETH needed)"),
        bullet('Step 3: User types: "Mint blockchain innovator badge for Jay"'),
        bullet("Step 4: AI processes — shows typing indicator with 'Preparing your badge mint...'"),
        bullet("Step 5: Transaction timeline animates: Quote → Settle → Execute → Confirm → Save"),
        bullet("Step 6: UGF pays gas with Mock USD — zero ETH used"),
        bullet("Step 7: NFT minted on Base Sepolia — badge appears in NFT gallery"),
        bullet("Step 8: Previous chats sidebar shows the session, just like Claude AI"),
        para(""),
        h2("3.3 Key App Features"),
        threeColTable("Feature", "What it does", "Status", [
          ["AI Chat Interface", "Natural language blockchain commands", "Done"],
          ["Intent Parser", "Regex rules + Google Gemini fallback", "Done"],
          ["UGF Integration", "Gasless execution via Mock USD", "Done (env-dependent)"],
          ["Transaction Timeline", "Animated step-by-step progress in chat", "Done"],
          ["NFT Gallery", "Shows all minted badges per wallet", "Done"],
          ["Previous Chats Sidebar", "ChatGPT/Claude-style session history", "Done"],
          ["Wallet Auth (JWT)", "Sign message with wallet → JWT token", "Done"],
          ["Supabase DB", "Persists all users, chats, transactions, NFTs", "Done"],
        ], 2400, 4000, 2960),
  
        pageBreak(),
  
        // ── SECTION 4: ARCHITECTURE ──────────────────────────────
        h1("4. System Architecture"),
        para("UGF AgentX is a full-stack Web3 application with three distinct layers: a React frontend, an Express.js backend, and the UGF SDK + Base Sepolia blockchain layer."),
        para(""),
        h2("4.1 High-Level Architecture"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 3480, 3480],
          rows: [
            new TableRow({
              children: ["Layer", "Technology", "Responsibility"].map((h, i) => new TableCell({
                borders: accentBorders,
                width: { size: [2400, 3480, 3480][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Frontend", "React + Vite + Wagmi + ConnectKit + Zustand", "Chat UI, wallet connection, timeline animation, NFT gallery, session sidebar"],
              ["Backend", "Express.js (Node.js) on port 5000", "Intent parsing, Gemini AI fallback, JWT auth, Supabase writes, UGF execution"],
              ["Blockchain layer", "UGF SDK + Base Sepolia + ERC-721 contract", "Gasless tx execution, NFT minting, gas paid in Mock USD"],
              ["Database", "Supabase (PostgreSQL)", "Users, chat sessions, messages, transactions, minted badges"],
              ["AI", "Google Gemini (gemini-1.5-flash)", "Fallback intent classification for unrecognised commands"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders,
                width: { size: [2400, 3480, 3480][i], type: WidthType.DXA },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("4.2 End-to-End Transaction Flow"),
        para("Phase A — Authentication"),
        bullet("User connects MetaMask via ConnectKit (UI only — no ETH needed)"),
        bullet("Backend generates a nonce message (UUID-based)"),
        bullet("User signs the nonce in their wallet (not a blockchain transaction — just a message)"),
        bullet("Backend verifies the signature using viem.verifyMessage"),
        bullet("JWT token (7-day validity) issued — all future API calls use Bearer JWT"),
        para(""),
        para("Phase B — Chat initiates transaction"),
        bullet('User types e.g. "Mint badge for Jay"'),
        bullet("POST /api/chat called with JWT + message"),
        bullet("Backend rule-based parser matches intent → MINT_BADGE"),
        bullet("If unrecognized → Gemini AI classifies intent"),
        bullet("Mock gas estimate calculated (formula-based USD)"),
        bullet("Timeline steps generated (getStepsForIntent)"),
        bullet("Transaction row inserted to Supabase as status: pending"),
        bullet("Response sent to frontend immediately — before chain confirms"),
        para(""),
        para("Phase C — Async on-chain execution (if UGF configured)"),
        bullet("Background async job: executeUgfFlow() called"),
        bullet("Calldata encoded via viem (mintBadge or donate ABI)"),
        bullet("UGF: quote → settle Mock USD → sponsorAndExecute → poll status"),
        bullet("On success: transactions row patched with tx_hash, block_number, confirmed_at"),
        para(""),
        para("Phase D — Frontend shows result"),
        bullet("Timeline steps animate (1.5s per step) — simulated on frontend"),
        bullet("After timeline completes, wallet history reloaded from DB"),
        bullet("Real tx_hash appears in wallet panel after async job finishes"),
        para(""),
        h2("4.3 Wallet Auth vs On-Chain Signing"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2200, 2400, 4760],
          rows: [
            new TableRow({
              children: ["Who signs", "What they sign", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders,
                width: { size: [2200, 2400, 4760][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["User wallet (MetaMask)", "Login nonce message only", "Off-chain EIP-191 signature → JWT token. NOT a blockchain transaction."],
              ["Server signer (private key)", "UGF quote + contract calldata", "Pays Mock USD from server vault, sponsors on-chain execution via UGF"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders,
                width: { size: [2200, 2400, 4760][i], type: WidthType.DXA },
                margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 5: TECH STACK ──────────────────────────────
        h1("5. Full Technology Stack"),
        h2("5.1 Frontend"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({
              children: ["Technology", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3000, 6360][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["React + Vite", "Frontend framework — fast, modern, TypeScript"],
              ["Wagmi v2", "Ethereum wallet connection and on-chain reads (ETH balance)"],
              ["ConnectKit", "Beautiful wallet connection UI (MetaMask, WalletConnect)"],
              ["Zustand (useStore)", "State management — chat messages, wallet, active transaction"],
              ["Tailwind CSS", "Utility-first styling — dark professional AI theme"],
              ["Framer Motion", "Smooth animations for timeline and chat transitions"],
              ["viem", "Ethereum utils — address verification, message signing"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3000, 6360][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("5.2 Backend"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({
              children: ["Technology", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3000, 6360][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Express.js (Node.js)", "REST API server on port 5000"],
              ["@tychilabs/ugf-testnet-js", "UGF SDK — quote, settle, execute, poll"],
              ["@supabase/supabase-js", "PostgreSQL database client"],
              ["jsonwebtoken (JWT)", "7-day auth tokens after wallet signature login"],
              ["Google Gemini API", "AI fallback for unrecognised intent classification"],
              ["viem (backend)", "encodeFunctionData for contract calldata + verifyMessage"],
              ["ethers Wallet", "Server-side signer for UGF execution"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3000, 6360][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("5.3 Blockchain & Database"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3000, 6360],
          rows: [
            new TableRow({
              children: ["Component", "Details"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3000, 6360][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Base Sepolia", "Ethereum L2 testnet — all on-chain activity"],
              ["ERC-721 Contract", "Custom NFT contract with mintBadge(address, tokenURI) and donate(address, uint256)"],
              ["TYI Mock USD", "Testnet token for gas payment via UGF vault"],
              ["Supabase (PostgreSQL)", "7 tables: users, chat_sessions, chat_messages, transactions, minted_badges, ai_actions, analytics"],
              ["On-chain metadata", "Base64-encoded JSON tokenURI with embedded SVG — fully on-chain, no IPFS"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3000, 6360][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 6: DATABASE ──────────────────────────────────
        h1("6. Database Schema"),
        para("Supabase (PostgreSQL) is the system of record. 7 tables, designed lean for hackathon MVP."),
        para(""),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 3000, 3960],
          rows: [
            new TableRow({
              children: ["Table", "Purpose", "Key columns"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [2400, 3000, 3960][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["users", "Wallet identity + balances", "wallet_address (unique), mockusd_balance, eth_balance, total_transactions, total_nfts"],
              ["chat_sessions", "Conversation threads", "user_id (FK), title (auto from 1st message), updated_at"],
              ["chat_messages", "All AI + user messages", "session_id (FK), sender (user/assistant/system), message, message_type (normal/timeline/error)"],
              ["transactions", "All blockchain actions", "action_type, tx_hash, status (pending/success/failed), ugf_quote_id, gas_fee_mockusd, block_number, confirmed_at"],
              ["minted_badges", "NFT gallery records", "transaction_id (FK), user_id, token_id, badge_name, recipient_name, metadata_uri, tx_hash"],
              ["ai_actions", "Parser audit log", "original_prompt, parsed_action, extracted_data (JSONB), parser_type (regex/gemini), success"],
              ["analytics", "Demo metrics", "total_users, total_transactions, total_nfts, total_mockusd_spent"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [2400, 3000, 3960][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 7: API ENDPOINTS ──────────────────────────────
        h1("7. API Endpoints"),
        para("Express.js REST API running on port 5000. Protected routes require Authorization: Bearer <jwt> header."),
        para(""),
        h2("7.1 Auth Routes (public)"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3200, 6160],
          rows: [
            new TableRow({
              children: ["Endpoint", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3200, 6160][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["POST /api/auth/nonce", "Request a nonce message for wallet signing"],
              ["POST /api/auth/verify", "Verify wallet signature → return JWT"],
              ["POST /api/auth/google", "Google sandbox login (demo mode)"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3200, 6160][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("7.2 Chat Routes (protected)"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3600, 5760],
          rows: [
            new TableRow({
              children: ["Endpoint", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3600, 5760][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["POST /api/chat", "Main: parse intent, save messages, estimate gas, return steps"],
              ["GET /api/chat/sessions", "List all sessions for a wallet (sidebar)"],
              ["GET /api/chat/history/:sessionId", "Load all messages for a session"],
              ["DELETE /api/chat/sessions/:id", "Delete session + all its messages"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3600, 5760][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
        para(""),
        h2("7.3 Transaction & UGF Routes (protected)"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3600, 5760],
          rows: [
            new TableRow({
              children: ["Endpoint", "Purpose"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3600, 5760][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["POST /api/ugf/execute", "Direct UGF execution: quote → settle → execute → poll"],
              ["GET /api/transactions/:wallet", "Fetch full transaction history for a wallet"],
              ["GET /api/gallery/:wallet", "Fetch minted NFT badges for gallery display"],
              ["GET /api/wallet/:address", "Get wallet balances (ETH + Mock USD from DB)"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3600, 5760][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 8: TEAM ROLES ──────────────────────────────
        h1("8. Team Roles & Contributions"),
        h2("8.1 Role Breakdown"),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2400, 3000, 3960],
          rows: [
            new TableRow({
              children: ["Role", "Area", "Key work done"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [2400, 3000, 3960][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Frontend", "React UI / UX", "Chat UI, transaction timeline, NFT gallery, wallet panel, session sidebar, animations"],
              ["Backend", "Express.js / AI / DB", "Intent parser, Gemini AI fallback, JWT auth, UGF SDK integration, Supabase, all API routes"],
              ["Blockchain", "Smart contract / UGF", "ERC-721 contract deployment, UGF configuration, on-chain flow testing"],
              ["Team Lead / Planning", "Architecture / coordination", "System design, database schema, implementation planning, integration strategy"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [2400, 3000, 3960][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 9: DEMO SCRIPT ──────────────────────────────
        h1("9. Live Demo Script (for PPT presenter)"),
        para("Use this script during the live demo or when explaining the app to judges."),
        para(""),
        h2("9.1 Opening (30 seconds)"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"Every time someone tries to do something on Web3, they hit the same wall: \'You need ETH to pay gas.\' They don\'t have ETH. They give up. We removed that wall."', italics: true, size: 22, color: "1E1B4B" })]
        }),
        para(""),
        h2("9.2 Demo Steps"),
        bullet("Open the app — show the dark AI chat interface, no setup required"),
        bullet("Click 'Connect Wallet' — MetaMask connects to Base Sepolia"),
        bullet("Show wallet panel: ETH balance = 0.0000 (intentional — no ETH needed)"),
        bullet('Type in chat: "Mint blockchain innovator badge for Jay"'),
        bullet("Watch AI respond with 'Preparing your badge mint...'"),
        bullet("Watch transaction timeline animate: Getting UGF quote → Settling Mock USD → Executing on Base Sepolia → Confirming → Saving badge"),
        bullet("Show NFT gallery — badge appears with on-chain metadata"),
        bullet("Show previous chats sidebar — session saved like Claude/ChatGPT"),
        bullet("Show wallet panel transaction history — tx hash from Base Sepolia"),
        para(""),
        h2("9.3 Key Points to Emphasize to Judges"),
        bullet("The user typed one sentence. That triggered a real blockchain transaction."),
        bullet("Zero ETH was used. Gas was paid in Mock USD via UGF."),
        bullet("The NFT metadata is fully on-chain — no IPFS, no centralized storage."),
        bullet("The app works for anyone — no crypto knowledge required."),
        bullet("This is what Web3 UX should feel like."),
  
        pageBreak(),
  
        // ── SECTION 10: IMPLEMENTATION STATUS ──────────────────────────────
        h1("10. Implementation Status"),
        para("Overall backend readiness: ~78% for hackathon MVP. Chat + auth + DB are production-ready; on-chain path is code-complete but requires environment configuration."),
        para(""),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [3600, 2000, 3760],
          rows: [
            new TableRow({
              children: ["Area", "Progress", "Notes"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [3600, 2000, 3760][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Server & middleware", "100%", "Express, CORS, logging, error handling"],
              ["Wallet auth (JWT)", "95%", "Nonce + signature + Bearer on all protected routes"],
              ["Chat & intent parsing", "95%", "Rule parser + Gemini fallback + full DB persistence"],
              ["Chat sessions API (sidebar)", "100%", "List, history, delete, auto-title on first message"],
              ["Transaction timeline in chat", "100%", "aiSteps + transactionSteps via responseEngine.ts"],
              ["Transaction / gallery / wallet APIs", "90%", "CRUD + reads; minor gaps in auth on one route"],
              ["UGF on-chain execution", "75%", "Code complete; needs env config + contract deploy"],
              ["Smart contract in repo", "0%", "No Solidity checked in yet — needs deployment"],
              ["Production hardening", "40%", "No Zod schemas; partial env validation"],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [3600, 2000, 3760][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: i === 1 ? "059669" : "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 11: PPT SLIDE OUTLINE ──────────────────────────────
        h1("11. Recommended PPT Slide Structure"),
        para("Use this as the exact slide-by-slide outline for your presentation. 12-15 slides recommended for a 5-minute demo pitch."),
        para(""),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1200, 3200, 4960],
          rows: [
            new TableRow({
              children: ["Slide", "Title", "Content / visual"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [1200, 3200, 4960][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["1", "Cover — UGF AgentX", "App name, tagline: 'AI-Powered Gasless Blockchain Assistant', hackathon name"],
              ["2", "The Problem", "Visual: user blocked by gas wall. Text: 'Every Web3 action requires ETH. Most users don\'t have it. They give up.'"],
              ["3", "The Solution — UGF", "Simple diagram: User pays USD → UGF → ETH gas paid → Blockchain. One sentence: 'Quote, Settle, Execute, Confirm.'"],
              ["4", "Meet AgentX", "App screenshot. Key: 'Type a command. UGF handles the gas. Action happens on-chain.'"],
              ["5", "How It Works — Flow", "4-step flow diagram: Connect wallet → Type command → AI parses intent → UGF executes gaslessly"],
              ["6", "Live Demo", "Screen recording or live: Mint badge for Jay → timeline animates → NFT minted → gallery shows badge"],
              ["7", "Tech Stack", "Split: Frontend (React/Wagmi/ConnectKit) | Backend (Express/Gemini/JWT) | Blockchain (UGF/Base Sepolia/ERC-721)"],
              ["8", "Architecture Diagram", "Simplified: User → React → Express → UGF SDK → Base Sepolia. Supabase below."],
              ["9", "Key Features", "6 icons: AI Chat | Gasless Txs | NFT Gallery | Session History | JWT Auth | Transaction Timeline"],
              ["10", "Database Design", "Simple table list with icons. 7 tables. Highlight: transactions + minted_badges as core."],
              ["11", "Gas Abstraction Deep Dive", "Side by side: Without UGF (6 painful steps) vs With UGF (1 button click)"],
              ["12", "UGF SDK Integration", "Code snippet showing quote→settle→execute→confirm. Simple, clean, powerful."],
              ["13", "Team", "Team member names and roles"],
              ["14", "Impact & USP", "Big quote: 'Do things on-chain. Pay in dollars. Never think about ETH.' + use cases"],
              ["15", "Thank You + QR Code", "App URL, GitHub, contact. QR code to live demo."],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [1200, 3200, 4960][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 1 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── SECTION 12: KEY QUOTES & TALKING POINTS ──────────────────────────────
        h1("12. Key Quotes & Talking Points"),
        para("These are ready-to-use sentences for slides, speaker notes, and verbal pitches."),
        para(""),
        h2("12.1 Opening hook"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"The last thing stopping regular people from Web3 was gas. We removed it."', italics: true, bold: true, size: 24, color: "1E1B4B" })]
        }),
        para(""),
        h2("12.2 Product description"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"Type a command. Pay cents in USD. Your action is on the blockchain. No ETH. No setup. No confusion."', italics: true, size: 22, color: "1E1B4B" })]
        }),
        para(""),
        h2("12.3 UGF explanation"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"UGF is like a currency exchange. You pay in dollars. It handles the ETH gas. You just get your transaction done."', italics: true, size: 22, color: "1E1B4B" })]
        }),
        para(""),
        h2("12.4 Technical differentiation"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"No paymasters. No bundlers. No ERC-4337 complexity. Just quote, settle, execute, confirm — four SDK calls and a real on-chain transaction."', italics: true, size: 22, color: "1E1B4B" })]
        }),
        para(""),
        h2("12.5 User impact"),
        new Paragraph({
          spacing: { before: 120, after: 120 },
          border: { left: { style: BorderStyle.SINGLE, size: 8, color: "4F46E5", space: 8 } },
          indent: { left: 360 },
          children: [new TextRun({ text: '"Your parents could use this app. They wouldn\'t know they were using a blockchain."', italics: true, size: 22, color: "1E1B4B" })]
        }),
  
        pageBreak(),
  
        // ── SECTION 13: GLOSSARY ──────────────────────────────
        h1("13. Glossary (for non-technical slide designers)"),
        para("Use this to understand the terminology used across the project."),
        para(""),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 6560],
          rows: [
            new TableRow({
              children: ["Term", "Plain English meaning"].map((h, i) => new TableCell({
                borders: accentBorders, width: { size: [2800, 6560][i], type: WidthType.DXA },
                shading: { fill: "EEF2FF", type: ShadingType.CLEAR }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 20, color: "4F46E5" })] })]
              }))
            }),
            ...([
              ["Gas fee", "A small fee paid to the network to process a blockchain transaction. Normally paid in ETH."],
              ["UGF", "Universal Gas Framework — the service that pays gas on behalf of the user using Mock USD instead of ETH."],
              ["Mock USD (TYI)", "A fake test dollar used on the testnet. Not real money. Used to simulate gas payments."],
              ["Base Sepolia", "A test version of the Base blockchain (built by Coinbase). Like a sandbox — everything works but no real money."],
              ["ETH", "Ethereum's native currency. Normally required for gas fees. With UGF, users never need it."],
              ["NFT", "A digital certificate of ownership stored on the blockchain. In this app: badges and certificates."],
              ["ERC-721", "The standard type of smart contract used to create NFTs on Ethereum."],
              ["Smart contract", "A piece of code deployed on the blockchain that automatically executes when called."],
              ["Wallet", "A digital identity on the blockchain (like a username + password, but cryptographic). e.g. MetaMask."],
              ["JWT", "JSON Web Token — a secure login token issued after wallet sign-in. Works like a session cookie."],
              ["Supabase", "The database used by this app (PostgreSQL hosted in the cloud)."],
              ["Gemini AI", "Google's AI model — used as a fallback to understand user commands the rule-based parser doesn't recognise."],
              ["Intent", "What the user wants to do: MINT_BADGE, CLAIM_CERT, DONATE, or SEND_REWARD."],
              ["tokenURI", "A URL or Base64 string that stores the NFT's metadata (name, image, attributes). In this app, it's fully on-chain."],
              ["Transaction timeline", "The animated step list in the chat UI showing quote → settle → execute → confirm in real time."],
            ]).map(row => new TableRow({
              children: row.map((cell, i) => new TableCell({
                borders, width: { size: [2800, 6560][i], type: WidthType.DXA }, margins: cellMargins,
                children: [new Paragraph({ children: [new TextRun({ text: cell, size: 20, color: "374151", bold: i === 0 })] })]
              }))
            }))
          ]
        }),
  
        pageBreak(),
  
        // ── FINAL ──────────────────────────────
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 2000, after: 400 },
          children: [new TextRun({ text: "UGF AgentX", bold: true, size: 48, color: "4F46E5" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 200 },
          children: [new TextRun({ text: "Do things on-chain. Pay in dollars. Never think about ETH.", size: 28, italics: true, color: "374151" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: "Built for the UGF x TychiLabs Hackathon — May 2026", size: 20, color: "9CA3AF" })]
        }),
      ]
    }]
  });
  
  const outDir = require('path').join(__dirname, 'downloads');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = require('path').join(outDir, 'UGF_AgentX_PPT_Context.docx');

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(outPath, buffer);
    console.log('Saved:', outPath);
  });