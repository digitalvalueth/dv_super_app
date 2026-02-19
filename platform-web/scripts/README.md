# Migration Scripts

This directory contains migration scripts for updating data in Firestore.

## Available Scripts

### 1. Fix Image URL Encoding

Fixes Firebase Storage URLs that are missing proper URL encoding.

**Problem:**

- Old URLs: `...o/products/abc/file.jpg` (404 error)
- Fixed URLs: `...o/products%2Fabc%2Ffile.jpg` (works correctly)

**How to run:**

```bash
cd admin-web
npm run migrate:fix-image-urls
```

Or manually:

```bash
cd admin-web
npx tsx scripts/fix-image-url-encoding.ts
```

**What it does:**

1. Reads all products from Firestore
2. Checks each product's `imageUrl` field
3. Fixes URLs that are missing proper encoding
4. Updates the database with corrected URLs
5. Shows a summary of changes

**Safe to run:**

- ✅ Only updates URLs that need fixing
- ✅ Skips already-correct URLs
- ✅ Dry-run friendly (check console output first)
- ✅ No data deletion

**Output example:**

```
🔄 Starting migration: Fix image URL encoding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Found 10 products to check

🔧 SK-ML-003:
   Before: .../o/products/abc/file.jpg
   After:  .../o/products%2Fabc%2Ffile.jpg
   ✓ Updated successfully

✅ SK-ML-004: Already correct
⏭️  SK-ML-005: No image URL

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Migration Summary:
  ✅ Updated: 3
  ⏭️  Skipped: 7
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2. Migrate Image Field (Legacy)

Migrates `imageURL` field to `imageUrl` (camelCase standardization).

```bash
cd admin-web
npx tsx scripts/migrate-image-field.ts
```

## Requirements

- Node.js 18+
- Firebase credentials configured in `.env.local`
- Admin access to Firestore

## Environment Variables

Make sure these are set in `admin-web/.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIRESTORE_DATABASE_ID=(default)
```

## Troubleshooting

**Error: Cannot find module 'tsx'**

```bash
npm install -g tsx
# or
npx tsx scripts/fix-image-url-encoding.ts
```

**Error: Firebase not initialized**

- Check `.env.local` exists and has correct values
- Make sure you're in the `admin-web` directory

**Error: Permission denied**

- Verify Firebase credentials have write access
- Check Firestore security rules
