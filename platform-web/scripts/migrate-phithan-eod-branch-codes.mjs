#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import admin from "firebase-admin";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const COLLECTION_NAME = "phithanEodImports";
const MAX_WRITES_PER_BATCH = 400;

const args = new Set(process.argv.slice(2));
const isApplyMode = args.has("--apply");
const keepSourceDocs = args.has("--keep-source");
const shouldRenameDocIds = args.has("--rename-doc-ids");
const isVerbose = args.has("--verbose");

function loadEnv() {
  const envFiles = [
    path.join(projectRoot, ".env.local"),
    path.join(projectRoot, ".env"),
  ];

  for (const envFile of envFiles) {
    dotenv.config({ path: envFile, override: false });
  }
}

function normalizeBranchCode(value) {
  const raw = String(value || "").trim();
  const digitsOnly = raw.replace(/\D+/g, "");
  return digitsOnly || raw.replace(/\s+/g, "").toUpperCase();
}

function normalizePayloadData(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const nextPayload = { ...payload };
  if (typeof nextPayload.LocationID === "string") {
    nextPayload.LocationID = normalizeBranchCode(nextPayload.LocationID);
  }
  return nextPayload;
}

function initializeFirestore() {
  const databaseId =
    process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || "(default)";
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const rawPrivateKey =
    process.env.FIREBASE_ADMIN_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const privateKey = rawPrivateKey
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : undefined;

  if (!projectId) {
    throw new Error(
      "Missing Firebase project ID. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID.",
    );
  }

  if (!admin.apps.length) {
    if (clientEmail && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        projectId,
      });
    } else {
      admin.initializeApp({ projectId });
    }
  }

  return getFirestore(admin.app(), databaseId);
}

function buildTargetData(docId, data) {
  const sourceBranchCode =
    typeof data.sourceBranchCode === "string" && data.sourceBranchCode.trim()
      ? data.sourceBranchCode.trim()
      : String(data.branchCode || docId || "").trim();

  const normalizedBranchCode = normalizeBranchCode(data.branchCode || docId);
  const normalizedPayload = normalizePayloadData(data.data);

  return {
    ...data,
    branchCode: normalizedBranchCode,
    sourceBranchCode,
    data: normalizedPayload,
    updatedAt: FieldValue.serverTimestamp(),
  };
}

function describeDocChange(docId, targetData) {
  const locationId =
    targetData?.data && typeof targetData.data === "object"
      ? targetData.data.LocationID || "-"
      : "-";

  return `${docId} -> ${targetData.branchCode} (LocationID: ${locationId})`;
}

async function commitWriteOperations(db, writeOperations) {
  let committedBatches = 0;
  let currentWriteCount = 0;
  let batch = db.batch();

  for (const writeOperation of writeOperations) {
    if (currentWriteCount >= MAX_WRITES_PER_BATCH) {
      await batch.commit();
      committedBatches += 1;
      batch = db.batch();
      currentWriteCount = 0;
    }

    writeOperation(batch);
    currentWriteCount += 1;
  }

  if (currentWriteCount > 0) {
    await batch.commit();
    committedBatches += 1;
  }

  return committedBatches;
}

async function main() {
  loadEnv();
  const db = initializeFirestore();

  console.log("\n🔄 PHITHAN EOD Branch Code Migration");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`Mode: ${isApplyMode ? "APPLY" : "DRY RUN"}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Rename doc IDs: ${shouldRenameDocIds ? "yes" : "no"}`);
  console.log(`Keep source docs: ${keepSourceDocs ? "yes" : "no"}`);

  const snapshot = await db.collection(COLLECTION_NAME).get();
  const docs = snapshot.docs;
  console.log(`📦 Found ${docs.length} documents\n`);

  const existingIds = new Set(docs.map((doc) => doc.id));
  const plannedTargets = new Map();
  const renameOperations = [];
  const updateOperations = [];
  const noOpDocs = [];
  const conflicts = [];

  for (const docSnap of docs) {
    const data = docSnap.data();
    const targetData = buildTargetData(docSnap.id, data);
    const normalizedId = targetData.branchCode;
    const currentLocationId =
      data?.data &&
      typeof data.data === "object" &&
      typeof data.data.LocationID === "string"
        ? data.data.LocationID
        : null;
    const normalizedLocationId = currentLocationId
      ? normalizeBranchCode(currentLocationId)
      : null;

    const needsFieldUpdate =
      data.branchCode !== normalizedId ||
      data.sourceBranchCode !== targetData.sourceBranchCode ||
      (currentLocationId !== null &&
        currentLocationId !== normalizedLocationId);

    if (docSnap.id !== normalizedId && shouldRenameDocIds) {
      const existingTargetId = existingIds.has(normalizedId)
        ? normalizedId
        : null;
      const plannedSourceId = plannedTargets.get(normalizedId);

      if (existingTargetId || plannedSourceId) {
        conflicts.push({
          sourceId: docSnap.id,
          targetId: normalizedId,
          reason: existingTargetId
            ? `target document ${existingTargetId} already exists`
            : `target already planned from ${plannedSourceId}`,
        });
        continue;
      }

      plannedTargets.set(normalizedId, docSnap.id);
      renameOperations.push({
        sourceId: docSnap.id,
        targetId: normalizedId,
        sourceRef: docSnap.ref,
        targetRef: db.collection(COLLECTION_NAME).doc(normalizedId),
        targetData,
      });
      continue;
    }

    if (needsFieldUpdate) {
      updateOperations.push({
        docId: docSnap.id,
        ref: docSnap.ref,
        targetData,
      });
      continue;
    }

    noOpDocs.push(docSnap.id);
  }

  console.log(`✏️  Rename docs: ${renameOperations.length}`);
  console.log(`🛠️  Update-in-place docs: ${updateOperations.length}`);
  console.log(`⏭️  No-op docs: ${noOpDocs.length}`);
  console.log(`⚠️  Conflicts: ${conflicts.length}\n`);

  if (renameOperations.length > 0) {
    console.log("Rename preview:");
    renameOperations.forEach((operation) => {
      console.log(
        `  • ${describeDocChange(operation.sourceId, operation.targetData)}`,
      );
    });
    console.log("");
  }

  if (updateOperations.length > 0) {
    console.log("Field update preview:");
    updateOperations.forEach((operation) => {
      console.log(
        `  • ${describeDocChange(operation.docId, operation.targetData)}`,
      );
    });
    console.log("");
  }

  if (conflicts.length > 0) {
    console.log("Conflicts:");
    conflicts.forEach((conflict) => {
      console.log(
        `  • ${conflict.sourceId} -> ${conflict.targetId} (${conflict.reason})`,
      );
    });
    console.log("");
  }

  if (!isApplyMode) {
    console.log("Dry run complete. No Firestore changes were made.");
    console.log(
      shouldRenameDocIds
        ? "Run again with --apply --rename-doc-ids to rename document IDs and normalize branchCode fields."
        : "Run again with --apply to update branchCode fields in place. Add --rename-doc-ids if you also want to rename document IDs.",
    );
    return;
  }

  if (conflicts.length > 0) {
    console.error("❌ Migration aborted because conflicts were found.");
    process.exitCode = 1;
    return;
  }

  const writeOperations = [];

  for (const operation of renameOperations) {
    writeOperations.push((batch) =>
      batch.set(operation.targetRef, operation.targetData),
    );
    if (!keepSourceDocs) {
      writeOperations.push((batch) => batch.delete(operation.sourceRef));
    }
  }

  for (const operation of updateOperations) {
    writeOperations.push((batch) =>
      batch.set(operation.ref, operation.targetData, { merge: true }),
    );
  }

  const committedBatches = await commitWriteOperations(db, writeOperations);

  console.log("✅ Migration applied successfully");
  console.log(`   Batches committed: ${committedBatches}`);
  console.log(`   Renamed docs: ${renameOperations.length}`);
  console.log(`   Updated docs: ${updateOperations.length}`);
  console.log(`   Source docs kept: ${keepSourceDocs ? "yes" : "no"}`);

  if (isVerbose && noOpDocs.length > 0) {
    console.log("\nNo-op docs:");
    noOpDocs.forEach((docId) => console.log(`  • ${docId}`));
  }
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exitCode = 1;
});
