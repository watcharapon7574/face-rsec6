# ระบบลงเวลา ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 จังหวัดลพบุรี

ระบบ PWA สำหรับลงเวลาเข้า-ออกงานด้วยการสแกนใบหน้า รองรับหลายหน่วยบริการ (ทุกอำเภอในจังหวัดลพบุรี) พร้อม Liveness Detection ป้องกันการใช้รูปภาพ/วิดีโอแทนคนจริง

## Features

- **Face Liveness Detection** - ตรวจจับการกะพริบตา + ขยับหัว ป้องกันใช้รูป/วิดีโอ
- **หลายหน่วยบริการ** - รองรับ 11 หน่วยบริการ (ศูนย์ฯ หลัก + ทุกอำเภอในลพบุรี) แต่ละแห่งมีพิกัด GPS + รัศมีของตัวเอง
- **Geofencing** - ตรวจสอบ GPS อัตโนมัติ, หาหน่วยบริการที่ใกล้ที่สุดในรัศมี
- **Device Fingerprint** - 1 อุปกรณ์/ครู/วัน ต้องใช้เครื่องเดียวกันเข้า-ออก
- **Time Window** - ลงเวลาได้ในช่วงเวลาที่กำหนดเท่านั้น
- **PWA** - ติดตั้งบนมือถือเหมือนแอปจริง
- **Admin Dashboard** - จัดการครู, หน่วยบริการ, ดูประวัติ, ตั้งค่าเวลา

## หน่วยบริการที่รองรับ

| # | หน่วยบริการ | อำเภอ |
|---|---|---|
| 1 | ศูนย์การศึกษาพิเศษ เขตการศึกษา 6 (สำนักงานใหญ่) | เมืองลพบุรี |
| 2 | หน่วยบริการอำเภอพัฒนานิคม | พัฒนานิคม |
| 3 | หน่วยบริการอำเภอโคกสำโรง | โคกสำโรง |
| 4 | หน่วยบริการอำเภอชัยบาดาล | ชัยบาดาล |
| 5 | หน่วยบริการอำเภอท่าวุ้ง | ท่าวุ้ง |
| 6 | หน่วยบริการอำเภอบ้านหมี่ | บ้านหมี่ |
| 7 | หน่วยบริการอำเภอท่าหลวง | ท่าหลวง |
| 8 | หน่วยบริการอำเภอสระโบสถ์ | สระโบสถ์ |
| 9 | หน่วยบริการอำเภอโคกเจริญ | โคกเจริญ |
| 10 | หน่วยบริการอำเภอลำสนธิ | ลำสนธิ |
| 11 | หน่วยบริการอำเภอหนองม่วง | หนองม่วง |

## Tech Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript
- **Supabase** (PostgreSQL + RLS) — ใช้ร่วมกับ FastDoc ได้
- **TensorFlow.js** + MediaPipe Face Mesh (Liveness Detection)
- **Tailwind CSS v4** + **Lucide Icons**

## Setup

### 1. Supabase

ใช้ Supabase project ที่มีอยู่แล้วได้เลย:

1. ไปที่ SQL Editor แล้วรัน `supabase/schema.sql`
2. จะสร้างตาราง: `attendance_settings`, `locations`, `teachers`, `attendance_records`
3. ข้อมูลหน่วยบริการทั้ง 11 แห่งจะถูก insert อัตโนมัติ

### 2. Environment Variables

```bash
cp .env.example .env.local
```

แก้ไข `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run

```bash
npm install
npm run dev
```

เปิด http://localhost:3000

### 4. Admin Setup

1. เข้า `/admin` → กรอก PIN: `0000`
2. **แท็บ "หน่วยบริการ"** → แก้พิกัด GPS ของแต่ละหน่วยให้ตรงจริง (กดที่หน่วยเพื่อแก้ไข)
3. **แท็บ "ครู"** → เพิ่มครู/บุคลากร พร้อมระบุหน่วยบริการประจำ
4. **แท็บ "ตั้งค่า"** → ปรับช่วงเวลาเข้า-ออกงาน

## UX Flow (ครูใช้งาน)

1. **ครั้งแรก**: กรอกรหัสครู + PIN → บันทึกในอุปกรณ์
2. **ทุกวัน**: เปิดแอป → ระบบตรวจ GPS + เวลา + หน่วยบริการ อัตโนมัติ → กะพริบตา + ขยับหัว → **กดปุ่มเดียว** จบ
3. ระบบจะแสดงชื่อหน่วยบริการที่ตรวจพบอัตโนมัติ

## Supabase Tables

- **`attendance_settings`** — ตั้งค่าเวลาเข้า-ออก (singleton)
- **`locations`** — หน่วยบริการ (พิกัด, รัศมี)
- **`teachers`** — ครู/บุคลากร (ผูกกับหน่วยบริการ)
- **`attendance_records`** — ประวัติลงเวลา (ผูกทั้งครูและหน่วยบริการ)

## MCP Server (AI Assistant Integration)

ระบบมี **MCP Server** สำหรับจัดการ Supabase ผ่าน AI assistant (Claude Desktop, Windsurf, Cline)

### Setup MCP Server

```bash
cd mcp-server
npm install
npm run build
```

### Configure for Windsurf

แก้ไข `.windsurf/mcp.json` (มีไฟล์ตัวอย่างแล้ว):

```json
{
  "mcpServers": {
    "face-attendance": {
      "command": "node",
      "args": ["./mcp-server/dist/index.js"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

Reload Windsurf แล้วใช้คำสั่งเช่น:
- "แสดงรายการหน่วยบริการทั้งหมด"
- "เพิ่มครู รหัส T001 ชื่อ นายสมชาย ใจดี"
- "แก้พิกัดหน่วยบริการอำเภอเมืองลพบุรี เป็น lat 14.7995, lng 100.6534"
- "ดูประวัติลงเวลาวันนี้"

ดูรายละเอียดเพิ่มเติมใน [`mcp-server/README.md`](./mcp-server/README.md)
