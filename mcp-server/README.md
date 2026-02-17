# Face Attendance MCP Server

MCP Server สำหรับจัดการ Supabase database ของระบบลงเวลา ศกศ.6 ลพบุรี ผ่าน AI assistant (Claude Desktop, Windsurf, Cline)

## Features

MCP Server นี้มี tools สำหรับ:

- ✅ **list_locations** - ดูรายการหน่วยบริการทั้งหมด
- ✅ **update_location** - แก้ไขพิกัด GPS และรัศมีของหน่วยบริการ
- ✅ **list_teachers** - ดูรายการครู/บุคลากร (filter ตามหน่วยบริการได้)
- ✅ **add_teacher** - เพิ่มครูใหม่
- ✅ **delete_teacher** - ลบครู
- ✅ **list_attendance_records** - ดูประวัติลงเวลา (filter ตามวัน/หน่วย/ครู)
- ✅ **get_settings** - ดูการตั้งค่าเวลาเข้า-ออก
- ✅ **update_settings** - แก้ไขช่วงเวลาเข้า-ออกงาน

## Setup

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure MCP Client

#### สำหรับ Claude Desktop

แก้ไขไฟล์ `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "face-attendance": {
      "command": "node",
      "args": [
        "/Users/watcharaponaonpan/Desktop/งานส่วนตัว/ProjectDev/face-rsec6/mcp-server/dist/index.js"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

#### สำหรับ Windsurf

แก้ไขไฟล์ `.windsurf/mcp.json` ในโปรเจค:

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

#### สำหรับ Cline (VS Code)

แก้ไขไฟล์ VS Code settings (`settings.json`):

```json
{
  "cline.mcpServers": {
    "face-attendance": {
      "command": "node",
      "args": [
        "/Users/watcharaponaonpan/Desktop/งานส่วนตัว/ProjectDev/face-rsec6/mcp-server/dist/index.js"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "your-anon-key"
      }
    }
  }
}
```

### 4. Restart AI Assistant

- **Claude Desktop**: ปิดแล้วเปิดใหม่
- **Windsurf**: Reload window
- **Cline**: Reload VS Code

## Usage Examples

### ดูรายการหน่วยบริการทั้งหมด

```
ช่วยแสดงรายการหน่วยบริการทั้งหมดให้หน่อย
```

### แก้ไขพิกัด GPS ของหน่วยบริการ

```
แก้พิกัดหน่วยบริการอำเภอเมืองลพบุรี เป็น lat: 14.7995, lng: 100.6534, รัศมี 500 เมตร
```

### เพิ่มครูใหม่

```
เพิ่มครู รหัส T001, ชื่อ นายสมชาย ใจดี, ตำแหน่ง ครู, หน่วยบริการอำเภอเมืองลพบุรี, PIN 1234
```

### ดูประวัติลงเวลาวันนี้

```
แสดงประวัติลงเวลาวันนี้ทั้งหมด
```

### ดูประวัติลงเวลาของหน่วยบริการเฉพาะ

```
แสดงประวัติลงเวลาวันที่ 2024-02-17 ของหน่วยบริการอำเภอพัฒนานิคม
```

### แก้ไขเวลาเข้า-ออกงาน

```
แก้เวลาเข้างานเป็น 07:30-09:00 และเวลาออกงานเป็น 16:00-17:30
```

## Tools Reference

### list_locations
ดูรายการหน่วยบริการทั้งหมด พร้อมพิกัดและรัศมี

**Parameters:** ไม่มี

### update_location
แก้ไขพิกัด GPS และรัศมีของหน่วยบริการ

**Parameters:**
- `location_id` (required): UUID ของหน่วยบริการ
- `lat` (optional): Latitude
- `lng` (optional): Longitude
- `radius_meters` (optional): รัศมีเป็นเมตร

### list_teachers
ดูรายการครู/บุคลากร

**Parameters:**
- `location_id` (optional): filter ตาม UUID ของหน่วยบริการ

### add_teacher
เพิ่มครูใหม่

**Parameters:**
- `teacher_id` (required): รหัสครู
- `full_name` (required): ชื่อ-นามสกุล
- `position` (optional): ตำแหน่ง
- `location_id` (optional): UUID หน่วยบริการประจำ
- `pin_code` (optional): PIN (default: 1234)
- `is_admin` (optional): สิทธิ์ admin (default: false)

### delete_teacher
ลบครู

**Parameters:**
- `teacher_id` (required): UUID ของครู

### list_attendance_records
ดูประวัติลงเวลา

**Parameters:**
- `date` (optional): วันที่ในรูปแบบ YYYY-MM-DD
- `location_id` (optional): filter ตามหน่วยบริการ
- `teacher_id` (optional): filter ตามครู
- `limit` (optional): จำนวนสูงสุด (default: 50)

### get_settings
ดูการตั้งค่าเวลาเข้า-ออกปัจจุบัน

**Parameters:** ไม่มี

### update_settings
แก้ไขช่วงเวลาเข้า-ออกงาน

**Parameters:**
- `check_in_start` (optional): เวลาเริ่มเข้างาน (HH:MM)
- `check_in_end` (optional): เวลาสิ้นสุดเข้างาน (HH:MM)
- `check_out_start` (optional): เวลาเริ่มออกงาน (HH:MM)
- `check_out_end` (optional): เวลาสิ้นสุดออกงาน (HH:MM)

## Development

```bash
# Watch mode
npm run dev

# Build
npm run build

# Run
npm start
```

## Notes

- MCP Server อ่านค่า env จาก `../.env.local` (root project)
- ต้อง build ก่อนใช้งาน (`npm run build`)
- ถ้าแก้โค้ด ต้อง build ใหม่และ restart AI assistant
