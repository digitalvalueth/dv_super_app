# 🚀 Cloud Build & Deployment Guide

## FITT BSA Admin Web - Cloud Run Deployment

คู่มือนี้อธิบายการ deploy Admin Web ไปยัง Google Cloud Run โดยใช้ Cloud Build

---

## 📋 สิ่งที่สร้างขึ้น

### ไฟล์ที่สร้าง:

1. **[admin-web/Dockerfile](admin-web/Dockerfile)** - Docker configuration สำหรับ Next.js
2. **[cloudbuild-production.yaml](cloudbuild-production.yaml)** - Production deployment config
3. **[cloudbuild-sandbox.yaml](cloudbuild-sandbox.yaml)** - Development/Sandbox deployment config
4. **[admin-web/.dockerignore](admin-web/.dockerignore)** - ไฟล์ที่ไม่ต้องการใน Docker image

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  GitHub Repository                       │
│                  (dev/main branch)                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ Push/Merge
                     ▼
┌─────────────────────────────────────────────────────────┐
│               Google Cloud Build                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  1. Clone Repository                             │   │
│  │  2. Build Docker Image (admin-web/Dockerfile)    │   │
│  │  3. Push to Artifact Registry                    │   │
│  │  4. Deploy to Cloud Run                          │   │
│  └──────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   Artifact Registry   │
         │  (Docker Images)      │
         └───────────┬───────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │     Cloud Run         │
         │  ┌─────────────────┐  │
         │  │  Sandbox/Dev    │  │
         │  │  fittsuperapp-  │  │
         │  │  dev            │  │
         │  └─────────────────┘  │
         │  ┌─────────────────┐  │
         │  │  Production     │  │
         │  │  fittsuperapp-  │  │
         │  │  prod           │  │
         │  └─────────────────┘  │
         └───────────────────────┘
```

---

## 🔧 Environment Configuration

### Sandbox/Development Environment

- **Database**: `fittsuperapp-dev`
- **Service Name**: `fittbsa-admin-web-dev`
- **Resources**:
  - Memory: 512Mi
  - CPU: 1
  - Max Instances: 2

### Production Environment

- **Database**: `fittsuperapp-prod`
- **Service Name**: `fittbsa-admin-web-prod`
- **Resources**:
  - Memory: 1Gi
  - CPU: 1
  - Max Instances: 5

---

## 📝 ขั้นตอนการตั้งค่า Cloud Build

### 1. สร้าง Artifact Registry Repository

```bash
# สร้าง repository สำหรับเก็บ Docker images
gcloud artifacts repositories create fittbsa \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="FITT BSA Docker Images"
```

### 2. เปิดใช้งาน APIs

```bash
# เปิดใช้งาน Cloud Build API
gcloud services enable cloudbuild.googleapis.com

# เปิดใช้งาน Cloud Run API
gcloud services enable run.googleapis.com

# เปิดใช้งาน Artifact Registry API
gcloud services enable artifactregistry.googleapis.com
```

### 3. ตั้งค่า Cloud Build Triggers

#### สำหรับ Sandbox/Development:

1. ไปที่ [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. คลิก **"CREATE TRIGGER"**
3. ตั้งค่าดังนี้:
   - **Name**: `admin-web-dev-deploy`
   - **Event**: Push to a branch
   - **Source**: Connect your repository
   - **Branch**: `^dev$`
   - **Configuration**: Cloud Build configuration file
   - **Location**: `cloudbuild-sandbox.yaml`
4. ใน **Substitution variables**, เพิ่ม:
   ```
   _FIREBASE_CLIENT_EMAIL = firebase-adminsdk-fbsvc@fittbsa.iam.gserviceaccount.com
   _FIREBASE_PRIVATE_KEY = [Your Firebase Private Key]
   _RESEND_API_KEY = [Your Resend API Key]
   _FROM_EMAIL = onboarding@resend.dev
   ```

#### สำหรับ Production:

1. ทำเหมือนขั้นตอนข้างบน แต่:
   - **Name**: `admin-web-prod-deploy`
   - **Branch**: `^main$`
   - **Location**: `cloudbuild-production.yaml`

---

## 🔐 Environment Variables (Secrets)

ค่าที่ต้องตั้งใน Cloud Build Trigger Substitution Variables:

| Variable                 | Description                    | Example                                             |
| ------------------------ | ------------------------------ | --------------------------------------------------- |
| `_FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK Email       | `firebase-adminsdk-xxx@xxx.iam.gserviceaccount.com` |
| `_FIREBASE_PRIVATE_KEY`  | Firebase Admin SDK Private Key | `-----BEGIN PRIVATE KEY-----\n...`                  |
| `_RESEND_API_KEY`        | Resend Email API Key           | `re_xxxxxxxxx`                                      |
| `_FROM_EMAIL`            | Email sender address           | `onboarding@resend.dev`                             |

> ⚠️ **หมายเหตุ**: สำหรับ `_FIREBASE_PRIVATE_KEY` ให้ใส่ทั้งหมดรวม `-----BEGIN PRIVATE KEY-----` และ `-----END PRIVATE KEY-----`

---

## 🚀 การ Deploy

### วิธีที่ 1: Auto Deploy (Recommended)

เมื่อตั้งค่า Triggers เรียบร้อยแล้ว, การ deploy จะเกิดขึ้นอัตโนมัติเมื่อ:

```bash
# Deploy to Sandbox/Dev
git push origin dev

# Deploy to Production
git push origin main
```

### วิธีที่ 2: Manual Deploy

```bash
# Deploy Sandbox/Dev manually
gcloud builds submit \
  --config=cloudbuild-sandbox.yaml \
  --substitutions=_FIREBASE_CLIENT_EMAIL="xxx",_FIREBASE_PRIVATE_KEY="xxx",_RESEND_API_KEY="xxx",_FROM_EMAIL="xxx"

# Deploy Production manually
gcloud builds submit \
  --config=cloudbuild-production.yaml \
  --substitutions=_FIREBASE_CLIENT_EMAIL="xxx",_FIREBASE_PRIVATE_KEY="xxx",_RESEND_API_KEY="xxx",_FROM_EMAIL="xxx"
```

---

## 📊 ตรวจสอบสถานะ Deployment

### ผ่าน Console:

- Cloud Build: https://console.cloud.google.com/cloud-build/builds
- Cloud Run: https://console.cloud.google.com/run

### ผ่าน CLI:

```bash
# ดู build logs
gcloud builds list --limit=5

# ดูสถานะ Cloud Run services
gcloud run services list --region=asia-southeast1

# ดู service URL
gcloud run services describe fittbsa-admin-web-dev --region=asia-southeast1 --format='value(status.url)'
```

---

## 🔍 Troubleshooting

### ปัญหา: Build ล้มเหลว

```bash
# ดู build logs โดยละเอียด
gcloud builds log [BUILD_ID]
```

### ปัญหา: Docker image ขนาดใหญ่เกินไป

- ตรวจสอบว่า `.dockerignore` ครบถ้วน
- ตรวจสอบว่า `node_modules` ไม่ถูก copy เข้า Docker image

### ปัญหา: Missing environment variables

- ตรวจสอบว่าตั้งค่า Substitution Variables ถูกต้องใน Cloud Build Trigger
- ตรวจสอบว่า environment variables ใน `cloudbuild-*.yaml` ถูกต้อง

---

## 💰 ค่าใช้จ่ายประมาณการ

### Cloud Run:

- **Sandbox/Dev**: ~$5-10/month (usage-based)
- **Production**: ~$20-50/month (depends on traffic)

### Cloud Build:

- First 120 build-minutes/day: **Free**
- Additional: $0.003/build-minute

### Artifact Registry:

- First 0.5 GB: **Free**
- Additional: $0.10/GB/month

---

## 📚 เอกสารเพิ่มเติม

- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

---

## ✅ Checklist

- [ ] สร้าง Artifact Registry repository
- [ ] เปิดใช้งาน APIs ที่จำเป็น
- [ ] สร้าง Cloud Build Triggers
- [ ] ตั้งค่า Substitution Variables
- [ ] Test deployment to Sandbox/Dev
- [ ] Verify service is running
- [ ] Test deployment to Production

---

**Created by**: Development Team  
**Last Updated**: February 17, 2026
