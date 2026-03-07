#!/bin/bash
# ══════════════════════════════════════════════════════════════
# Setup Static Egress IP for Cloud Run → Azure SQL Server
# ══════════════════════════════════════════════════════════════
#
# ปัญหา: Cloud Run ใช้ shared IP pool → Azure Firewall whitelist ไม่ได้
# วิธี: สร้าง VPC connector + Cloud NAT + Static IP
# ผลลัพธ์: Cloud Run ออก internet ผ่าน IP คงที่ → whitelist ใน Azure ได้
#
# ⏱ ใช้เวลา: ~10-15 นาที
# 💰 ค่าใช้จ่าย: ~$10-15/เดือน (VPC connector + NAT)
#
# Usage: bash scripts/setup-cloud-nat.sh
# ══════════════════════════════════════════════════════════════

set -e

PROJECT_ID=$(gcloud config get-value project)
REGION="asia-southeast1"
VPC_NETWORK="default"
SUBNET_NAME="cloud-run-subnet"
CONNECTOR_NAME="fittbsa-connector"
ROUTER_NAME="fittbsa-router"
NAT_NAME="fittbsa-nat"
STATIC_IP_NAME="fittbsa-egress-ip"

echo "═══════════════════════════════════════════"
echo "📋 Project: $PROJECT_ID"
echo "📍 Region:  $REGION"
echo "═══════════════════════════════════════════"

# ─── Step 1: Reserve a Static IP ───
echo ""
echo "1️⃣  Reserving static external IP..."
gcloud compute addresses create $STATIC_IP_NAME \
  --region=$REGION \
  --network-tier=PREMIUM \
  2>/dev/null || echo "   (IP already exists)"

STATIC_IP=$(gcloud compute addresses describe $STATIC_IP_NAME \
  --region=$REGION \
  --format="get(address)")
echo "   ✅ Static IP: $STATIC_IP"

# ─── Step 2: Create a VPC subnet for the connector ───
echo ""
echo "2️⃣  Creating VPC subnet for connector..."
gcloud compute networks subnets create $SUBNET_NAME \
  --network=$VPC_NETWORK \
  --region=$REGION \
  --range=10.8.0.0/28 \
  2>/dev/null || echo "   (Subnet already exists)"
echo "   ✅ Subnet: $SUBNET_NAME (10.8.0.0/28)"

# ─── Step 3: Create Serverless VPC Access Connector ───
echo ""
echo "3️⃣  Creating Serverless VPC Access connector..."
gcloud compute networks vpc-access connectors create $CONNECTOR_NAME \
  --region=$REGION \
  --subnet=$SUBNET_NAME \
  --min-instances=2 \
  --max-instances=3 \
  2>/dev/null || echo "   (Connector already exists)"
echo "   ✅ Connector: $CONNECTOR_NAME"

# ─── Step 4: Create Cloud Router ───
echo ""
echo "4️⃣  Creating Cloud Router..."
gcloud compute routers create $ROUTER_NAME \
  --network=$VPC_NETWORK \
  --region=$REGION \
  2>/dev/null || echo "   (Router already exists)"
echo "   ✅ Router: $ROUTER_NAME"

# ─── Step 5: Create Cloud NAT with Static IP ───
echo ""
echo "5️⃣  Creating Cloud NAT with static IP..."
gcloud compute routers nats create $NAT_NAME \
  --router=$ROUTER_NAME \
  --region=$REGION \
  --nat-external-ip-pool=$STATIC_IP_NAME \
  --nat-all-subnet-ip-ranges \
  2>/dev/null || echo "   (NAT already exists)"
echo "   ✅ NAT: $NAT_NAME → $STATIC_IP"

# ─── Step 6: Update Cloud Run services ───
echo ""
echo "6️⃣  Updating Cloud Run services to use VPC connector..."

# Sandbox (uat-app.fittbsa.com)
echo "   Updating fittbsa-admin-web-dev..."
gcloud run services update fittbsa-admin-web-dev \
  --region=$REGION \
  --vpc-connector=$CONNECTOR_NAME \
  --vpc-egress=all-traffic \
  2>/dev/null && echo "   ✅ Sandbox updated" || echo "   ⚠️ Failed to update sandbox"

# Production (app.fittbsa.com)
echo "   Updating fittbsa-admin-web-prod..."
gcloud run services update fittbsa-admin-web-prod \
  --region=$REGION \
  --vpc-connector=$CONNECTOR_NAME \
  --vpc-egress=all-traffic \
  2>/dev/null && echo "   ✅ Production updated" || echo "   ⚠️ Failed to update production"

# ─── Summary ───
echo ""
echo "═══════════════════════════════════════════"
echo "✅ SETUP COMPLETE"
echo "═══════════════════════════════════════════"
echo ""
echo "📌 Static Egress IP: $STATIC_IP"
echo ""
echo "📋 ส่ง IP นี้ให้ ITP (Phithan) เพื่อ whitelist ใน Azure SQL Firewall:"
echo ""
echo "   Azure Portal → SQL databases → phithandata"
echo "   → Networking → Firewall rules → Add"
echo "   → Start IP: $STATIC_IP"
echo "   → End IP:   $STATIC_IP"
echo ""
echo "   หรือรัน SQL บน master DB:"
echo "   EXEC sp_set_firewall_rule N'FITT-CloudRun', '$STATIC_IP', '$STATIC_IP';"
echo ""
echo "═══════════════════════════════════════════"
