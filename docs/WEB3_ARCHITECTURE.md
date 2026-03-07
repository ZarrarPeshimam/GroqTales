# Web3 Architecture — GroqTales / ComicCrafts

## Overview

GroqTales extends its storytelling platform with on-chain infrastructure on **Monad testnet**, using **CRAFTS** (ComicCraft Tokens) as the marketplace currency.

## Architecture

```mermaid
graph TD
    subgraph Frontend
        A[React/Next.js App]
    end

    subgraph Backend["Express.js Backend (Render)"]
        B["/api/v1/wallets"]
        C["/api/v1/marketplace"]
        D["/api/v1/nft"]
        E["/api/health/web3"]
        F[web3Service.js]
        G[tokenService.js]
        H[nftContractService.js]
    end

    subgraph Blockchain["Monad Testnet (via Alchemy)"]
        I[CraftToken.sol<br/>ERC-20]
        J[MonadStoryNFT.sol<br/>ERC-721]
        K[CraftsMarketplace.sol]
    end

    subgraph Storage
        L[(Supabase PostgreSQL)]
    end

    A --> B & C & D & E
    B --> F & G
    C --> F & G & H
    D --> F & H
    E --> F
    F --> I & J & K
    G --> I
    H --> J
    B & C & D --> L
```

## Contract Interaction Flows

### Minting a Story NFT

```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant Supabase
    participant MonadStoryNFT

    User->>Backend: POST /api/v1/nft/mint
    Backend->>Supabase: Create NFT DB record
    Backend->>MonadStoryNFT: mintStory(hash, metadataURI)
    MonadStoryNFT-->>Backend: StoryMinted event (tokenId)
    Backend->>Supabase: Update record with tokenId + txHash
    Backend-->>User: { tokenId, txHash }
```

### Buying from Marketplace

```mermaid
sequenceDiagram
    participant Buyer
    participant Backend
    participant CraftToken
    participant CraftsMarketplace
    participant MonadStoryNFT

    Buyer->>Backend: POST /api/v1/marketplace/buy
    Backend->>Backend: Validate listing, check balance
    Backend->>CraftToken: approve(marketplace, price)
    Backend->>CraftsMarketplace: buyItem(nftAddr, tokenId)
    CraftsMarketplace->>CraftToken: transferFrom(buyer, marketplace, price)
    CraftsMarketplace->>CraftToken: transfer(treasury, platformFee)
    CraftsMarketplace->>CraftToken: transfer(creator, royalty)
    CraftsMarketplace->>MonadStoryNFT: safeTransferFrom(seller, buyer, tokenId)
    Backend->>Backend: Update listing status → sold
    Backend-->>Buyer: { success, txHash }
```

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `MONAD_RPC_URL` | Alchemy Monad testnet RPC | `https://monad-testnet.g.alchemy.com/v2/KEY` |
| `MONAD_CHAIN_ID` | Monad testnet chain ID | `10143` |
| `ALCHEMY_API_KEY` | Alchemy API key | `your-key` |
| `PLATFORM_SIGNER_KEY` | Server-side wallet private key | `0x...` |
| `PLATFORM_TREASURY_ADDRESS` | Fee collection wallet | `0x...` |
| `PLATFORM_FEE_PERCENT` | Marketplace fee (%) | `2.5` |
| `CRAFTS_TOKEN_ADDRESS` | Deployed CRAFTS ERC-20 | `0x...` |
| `STORY_NFT_CONTRACT_ADDRESS` | Deployed MonadStoryNFT | `0x...` |
| `CRAFTS_MARKETPLACE_ADDRESS` | Deployed CraftsMarketplace | `0x...` |

## Deploying Contracts

```bash
cd smart_contracts
npx hardhat deploy --network monad_testnet --tags crafts       # CraftToken
npx hardhat deploy --network monad_testnet --tags crafts-marketplace  # CraftsMarketplace
```

After deployment, set the contract addresses in your Render environment variables.

## Mainnet Migration Checklist

1. **Audit contracts** — CraftToken and CraftsMarketplace should be audited before mainnet
2. **Cap token supply** — Replace `onlyOwner` mint with a max-supply mechanism
3. **KMS for signer** — Move `PLATFORM_SIGNER_KEY` to AWS KMS / GCP Cloud HSM
4. **Gas strategy** — Implement dynamic gas pricing and retry policies
5. **Monitoring** — Add on-chain event listeners for real-time marketplace activity
