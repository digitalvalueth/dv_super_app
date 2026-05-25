export const APP_VERSION = "1.5.1.1";

export interface ChangeEntry {
  type: "feature" | "fix" | "improvement";
  text: string;
  before?: string;
  after?: string;
}

export interface Release {
  version: string;
  date: string;
  title?: string;
  changes: ChangeEntry[];
}

export const CHANGELOG: Release[] = [
  {
    version: "1.5.1.1",
    date: "19 พฤษภาคม 2569",
    title: "แก้ไขครั้งที่ 1 · Import ผู้ใช้/สาขา · ชื่อสาขา Mobile",
    changes: [
      {
        type: "fix",
        text: "[Web] หน้า Import Users อ่านหัวคอลัมน์ Excel ได้ยืดหยุ่นขึ้น เช่น E-Mail, fullName, baCode, branchCode, supervisorEmail และ seller",
        before:
          "หัวคอลัมน์ที่สะกดไม่ตรงเป๊ะทำให้ชื่อ/อีเมล/รหัสพนักงานไม่ถูกดึง",
        after:
          "Normalize header ก่อนอ่านข้อมูล จึงรองรับช่องว่าง ขีดกลาง ตัวพิมพ์ และ BOM จาก Excel",
      },
      {
        type: "fix",
        text: "[Web] Import Users อัปเดตผู้ใช้เดิมด้วย email ในบริษัทเดียวกัน แทนการ fail ว่ามีสมาชิกอยู่แล้ว",
        before:
          "ผู้ใช้เดิมไม่ได้รับ fullName, BA Code, seller, supervisor หรือ branch mapping จากไฟล์ import",
        after: "อัปเดต user doc เดิมและเพิ่ม branchIds/branchNames ให้ถูกต้อง",
      },
      {
        type: "fix",
        text: "[Web] Import Branches เพิ่มคอลัมน์ supervisorEmail และบันทึก sellerCategory/supervisor fields ให้ครบ",
      },
      {
        type: "fix",
        text: "[Web/Mobile] รับคำเชิญแล้ว resolve ชื่อสาขาจาก branches ล่าสุด และบันทึก sellerCategory/branchNames ให้ตรงกัน",
      },
      {
        type: "fix",
        text: "[Mobile] ผู้ใช้ที่มีสาขาเดียวสามารถแสดงชื่อสาขาและเข้า Stock Counter ได้ แม้ข้อมูลอยู่ใน branchIds/branchNames แต่ branchId/branchName ว่าง",
      },
      {
        type: "improvement",
        text: "[Web] หน้า Users ค้นหาด้วยชื่อจริงภาษาไทย, BA Code, email, branch code และชื่อสาขาได้ พร้อมปรับ modal แก้ไขผู้ใช้ให้เลื่อนง่ายขึ้น",
      },
      {
        type: "fix",
        text: "[Web] หน้าแก้ไขงานนับสต็อกของสาขา: เลือกแบรนด์สินค้าแล้วบันทึกเฉพาะสินค้าของแบรนด์นั้นจริง เช่น PrimaNest 32 รายการ ไม่ดึงทุกแบรนด์กลับมา",
        before:
          "ปุ่มแบรนด์เป็นแค่ตัวกรองหน้าจอ ทำให้ตอนบันทึกยังส่ง productIds ทุกแบรนด์ที่ซ่อนอยู่",
        after:
          "ใช้ brand filter เป็นขอบเขตของการบันทึก และปรับตัวเลข/ปุ่มใน modal ให้ตรงกับรายการที่จะ save",
      },
      {
        type: "fix",
        text: "[Web] หน้า Users ป้องกันการเลือกหัวหน้างานคนละสาขาใน modal แก้ไขผู้ใช้",
        before:
          "Dropdown supervisor แสดงหัวหน้างานทุกคนในบริษัท แม้ไม่ได้อยู่หรือดูแลสาขาของพนักงาน",
        after:
          "กรองหัวหน้างานจาก branchIds/managedBranchIds ให้ตรงกับสาขาพนักงาน และ validate ซ้ำก่อนบันทึก",
      },
      {
        type: "fix",
        text: "[Mobile] แก้ขอบขาวด้านล่างใต้ tab bar บน iOS ให้พื้นหลังกลืนกับหน้า dashboard",
        before:
          "NativeTabs ปล่อย scroll-edge เป็นโปร่งใส และหน้า Home ครอบ bottom safe area เอง ทำให้ยังเห็นแถบขาวเฉพาะหน้าแรก",
        after:
          "กำหนดพื้นหลัง tab bar เป็นสีพื้นหลังของแอป ปิด transparent scroll-edge และให้ Home ใช้เฉพาะ top safe area",
      },
      {
        type: "improvement",
        text: "[Web] Modal แก้ไขผู้ใช้ปรับตัวเลือกสาขาที่รับผิดชอบเป็น 2 ฝั่ง: สาขาที่เลือกแล้ว / สาขาที่ยังไม่ได้เลือก เพื่อใช้งานกับสาขาหลายร้อยรายการได้ง่ายขึ้น",
        before:
          "รายการสาขาเป็น checkbox list เดียว ทำให้ดูยากเมื่อมี 500-600 สาขา",
        after:
          "แยก selected/available lists พร้อมค้นหา ลบ เพิ่มทีละสาขา และเพิ่มผลลัพธ์ที่ค้นหา",
      },
      {
        type: "fix",
        text: "[Web] แก้ปัญหาเปิดสิทธิ์ Watson Excel Validator แล้วกดเข้าไม่ได้ เพราะ route guard ตรวจ module id/company context ไม่ตรงกับหน้าเลือก Module",
        before:
          "หน้าแรกเห็น card และหน้าจัดการสิทธิ์ติ๊กถูกแล้ว แต่พอเข้า module ยังขึ้นว่าไม่มีสิทธิ์เข้าถึง module นี้",
        after:
          "รองรับ alias module id ระหว่าง watson กับ watson-excel-validator และให้ guard ใช้ active company พร้อม refresh user ล่าสุดก่อนปฏิเสธสิทธิ์",
      },
    ],
  },
  {
    version: "1.5.1",
    date: "19 พฤษภาคม 2569",
    title: "โครงสร้างทีมงาน · ระบบสิทธิ์ Module · รวม Role · แก้ BA Code",
    changes: [
      // ── Access Control ──────────────────────────────────────
      {
        type: "improvement",
        text: "[Web] บล็อก Employee / Staff จากเว็บแอดมิน — ต้องใช้งานผ่าน Mobile App เท่านั้น",
        before: "Employee ล็อกอินเว็บได้ แต่ไม่มีข้อมูล",
        after: "แสดงหน้า 'กรุณาใช้งานผ่าน Mobile App' พร้อมปุ่มออกจากระบบ",
      },
      {
        type: "improvement",
        text: "[Web] Admin เห็นเฉพาะ Module ที่ได้รับสิทธิ์ (ไม่ bypass อัตโนมัติอีกต่อไป) — เฉพาะ Super Admin เท่านั้นที่เห็นทุก Module",
        before: "Admin เห็นทุก Module โดยอัตโนมัติ",
        after: "Admin เห็นเฉพาะ Module ที่ถูกเพิ่มใน whitelist",
      },
      {
        type: "feature",
        text: "[Web] Admin จัดการสิทธิ์ Module ให้ผู้ใช้ที่ role ต่ำกว่าได้ (Supervisor, Manager, Employee) จากหน้า 'จัดการสิทธิ์'",
      },
      {
        type: "improvement",
        text: "[Web] ป้องกันการแก้ไขสิทธิ์ของ Role เดียวกันหรือสูงกว่า (แสดง 🔒)",
        before: "Admin เห็นปุ่ม toggle ของ Admin คนอื่น (แต่กดไม่ได้)",
        after:
          "แสดง 🔒 พร้อม tooltip 'ไม่สามารถจัดการ role ระดับเดียวกันหรือสูงกว่า'",
      },
      // ── Role Consolidation ──────────────────────────────────
      {
        type: "improvement",
        text: "[Web] รวม Role 'Staff' กับ 'Employee' เป็น 'Employee' อย่างเดียว — ลบ Staff ออกจาก Dropdown ทุกหน้า",
        before: "5 roles: admin, manager, supervisor, employee, staff",
        after: "4 roles: admin, manager, supervisor, employee",
      },
      {
        type: "improvement",
        text: "[Web] เปลี่ยนชื่อเมนู 'จัดการ Manager' → 'จัดการ Supervisor' พร้อมรองรับ query ทั้ง supervisor และ manager",
      },
      {
        type: "feature",
        text: "[Web] เพิ่มช่องค้นหาสาขาใน Modal เลือกสาขา (จัดการ Supervisor)",
      },
      // ── Import Excel ────────────────────────────────────────
      {
        type: "feature",
        text: "[Web] เทมเพลตนำเข้าสาขา (Excel): เพิ่มคอลัมน์ 'seller' บันทึก Seller Category ลง Firestore",
      },
      {
        type: "fix",
        text: "[Web] แก้ BA Code ที่มีเลข 0 นำหน้า (เช่น 0087) ถูกตัดเหลือ 87 เมื่อนำเข้าผ่าน Excel",
        before: "BA Code: 0087 → นำเข้าได้ 87",
        after:
          "BA Code: 0087 → นำเข้าได้ 0087 (อ่าน formatted text จาก raw cell)",
      },
      // ── Team Structure ──────────────────────────────────────
      {
        type: "feature",
        text: "[Web] ใหม่! หน้า 'จัดการทีมงาน' — ออกแบบใหม่เป็นโครงสร้าง Tree: Manager → Supervisor → สาขา\n\n📌 วิธีใช้:\n1. ไปที่เมนู 🛡️ จัดการทีมงาน\n2. Tab 'Manager → Supervisor' — กดที่ชื่อ Manager เพื่อดู Supervisor ที่ดูแล กด ✏️ เพื่อเพิ่ม/ลบ Supervisor\n3. Tab 'Supervisor → สาขา' — กดที่ชื่อ Supervisor เพื่อดูสาขาที่ดูแล กด ✏️ เพื่อเพิ่ม/ลบสาขา\n4. Manager จะเห็นสาขารวมจาก Supervisor ทั้งหมดที่ดูแล",
        before:
          "หน้าจัดการ Supervisor — แสดง flat list เหมือนกันทั้ง Manager/Supervisor",
        after:
          "หน้าจัดการทีมงาน — 2 Tab: Manager → Supervisor (Tree) + Supervisor → สาขา พร้อม Supervisor อิสระ",
      },
      {
        type: "improvement",
        text: "[Web] เมนู Sidebar: เปลี่ยนชื่อจาก 'Supervisor' เป็น 'จัดการทีมงาน' เพื่อให้ตรงกับฟีเจอร์ใหม่",
      },
    ],
  },
  {
    version: "1.5.0",
    date: "7 พฤษภาคม 2569",
    title: "ระบบหลังบ้านสาขา · Seller Category · จำกัดรัศมีถ่ายรูป",
    changes: [
      // ── Mobile App ──────────────────────────────────────────
      {
        type: "fix",
        text: "[Mobile] แก้บั๊กรูปนับสต็อกแสดงข้ามสาขา — เมื่อ SKU เดียวกันมีอยู่หลายสาขา รูปจากสาขา A เคยไปโผล่ในหน้าสินค้าของสาขา B",
        before:
          "Query ดึง session ตาม productId + userId เท่านั้น → รูปจากทุกสาขาของ user คนนั้นปนกัน",
        after:
          "เพิ่ม branchId ใน Firestore query + filter ฝั่ง client ทั้งหน้า Product Details และ Completed Products",
      },
      {
        type: "improvement",
        text: "[Mobile] นำปุ่ม 'เลือกรูปจากคลัง' ออกจากหน้าถ่ายรูปรับสินค้า เหลือเฉพาะการถ่ายรูปใหม่เท่านั้น",
        before: "ถ่ายรูป | เลือกจากคลัง",
        after: "ถ่ายรูปเท่านั้น (กันการอัปโหลดรูปเก่าจากคลัง)",
      },
      {
        type: "improvement",
        text: "[Mobile] จำกัดรัศมี Geofence ของสาขาสูงสุดไม่เกิน 500 เมตร เพื่อความแม่นยำในการเช็คอิน",
        before: "ตั้งรัศมีได้ถึง 5,000 เมตร — เสี่ยงนับสต็อกนอกสาขา",
        after: "รัศมีสูงสุด 500 เมตร (default 200 m)",
      },
      // ── Web Admin · จัดการสาขา ──────────────────────────────
      {
        type: "improvement",
        text: "[Web] หน้าจัดการสาขา: เปลี่ยนการแสดงผลจาก Card เป็น Table เพื่อดูข้อมูลครบในครั้งเดียว",
        before: "Card 2-3 สาขา/แถว",
        after:
          "ตาราง: ชื่อสาขา · รหัส · บริษัท · Seller Category · Supervisor · Geofence · พนักงาน · จัดการ",
      },
      {
        type: "feature",
        text: "[Web] หน้าจัดการสาขา: เพิ่มฟิลด์ Seller Category และ Supervisor ของแต่ละสาขา (กรอกอิสระ + แนะนำคำที่ใช้บ่อย เช่น Lotus, BigC, Watson)",
      },
      {
        type: "feature",
        text: "[Web] หน้าจัดการสาขา: ค้นหา/กรองสาขาตาม Seller Category และ Supervisor ได้",
      },
      {
        type: "fix",
        text: "[Web] ป้องกันการบันทึกรหัสสาขาซ้ำในบริษัทเดียวกัน — ระบบตรวจสอบก่อน save และแจ้ง error",
        before: "บันทึกรหัสซ้ำได้โดยไม่มีการแจ้งเตือน",
        after: 'แจ้ง toast: รหัสสาขา "BKK01" มีอยู่แล้วในบริษัทนี้',
      },
      {
        type: "improvement",
        text: "[Web] ฟอร์มสาขา: จำกัดรัศมีให้เลือกได้ 50–500 เมตรเท่านั้น พร้อมข้อความแนะนำ",
      },
      // ── Web Admin · จัดการผู้ใช้ ─────────────────────────────
      {
        type: "feature",
        text: "[Web] หน้าจัดการผู้ใช้: เพิ่มฟิลด์ Seller Category และ Supervisor (หัวหน้าพนักงาน) ในข้อมูลพนักงาน",
      },
      // ── Web Admin · เชิญผู้ใช้ ───────────────────────────────
      {
        type: "feature",
        text: "[Web] หน้าเชิญผู้ใช้: แสดงคอลัมน์ ชื่อ-สกุล และรหัสพนักงาน (BA Code) ในตารางคำเชิญ",
        before: "อีเมล | บทบาท | สาขา | …",
        after: "อีเมล/ชื่อ-สกุล | รหัสพนักงาน | บทบาท | สาขา | …",
      },
      {
        type: "feature",
        text: "[Web] หน้าเชิญผู้ใช้: เพิ่มปุ่มเปิด/ปิดการใช้งานบัญชี (สำหรับคำเชิญที่ accepted แล้ว) — admin กดเพื่อระงับ/คืนสิทธิ์ใช้งาน",
        before: "ทำได้แค่ยกเลิกคำเชิญ pending",
        after: "ยกเลิก pending + ปิด/เปิดบัญชี accepted",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "27 เมษายน 2569",
    title: "Changelog & ระบบติดตามการอัปเดต",
    changes: [
      {
        type: "feature",
        text: "เพิ่มหน้า Changelog แสดงประวัติการอัปเดตทุกเวอร์ชันแบบ Timeline",
      },
      {
        type: "feature",
        text: "Sidebar แสดงเลขเวอร์ชันปัจจุบัน (footer) — อ้างอิงจาก APP_VERSION",
      },
      {
        type: "feature",
        text: "Badge 'NEW' ที่หัว Changelog ของเวอร์ชันล่าสุด คลิก ✕ เพื่อปิดได้ (เก็บไว้แต่ละ user ใน localStorage)",
      },
      {
        type: "improvement",
        text: "แต่ละ Change รองรับการแสดง before/after diff (block สีแดง 'ก่อน' / สีเขียว 'หลัง')",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "เมษายน 2569",
    title: "ชื่อจริงพนักงาน & รหัสพนักงานในทุก Export",
    changes: [
      {
        type: "feature",
        text: "เพิ่มคอลัมน์ 'ชื่อจริงพนักงาน' และ 'รหัสพนักงาน' ใน Excel export ทุกรูปแบบ",
        before: "พนักงาน | อีเมล | สาขา | สินค้า ...",
        after: "พนักงาน | ชื่อจริงพนักงาน | รหัสพนักงาน | อีเมล | สาขา ...",
      },
      {
        type: "feature",
        text: "Watermark บนรูปภาพแสดงชื่อจริง (fullName) และรหัสพนักงาน [baCode] แทน username",
        before: "👤 wattchai (วัตสันสาขาเพชรไพบูลย์)",
        after: "👤 Watthachai Taechalue [BA2171] (วัตสันสาขาเพชรไพบูลย์)",
      },
      {
        type: "feature",
        text: "Modal ดูรูปภาพและ Lightbox เต็มจอแสดง overlay ชื่อจริง + รหัสพนักงาน",
        before: "ชื่อ: wattchai",
        after: "ชื่อ: Watthachai Taechalue\nรหัส: BA2171",
      },
      {
        type: "feature",
        text: "PDF export: ข้อความ 'ผู้นับ' แสดงชื่อจริงพนักงาน [รหัส] แทน username",
        before: "ผู้นับ: wattchai",
        after: "ผู้นับ: Watthachai Taechalue [BA2171]",
      },
      {
        type: "improvement",
        text: "รวมคอลัมน์ 'ตำแหน่งที่อยู่' และ 'พิกัด' เป็น 'ตำแหน่ง/พิกัด' คอลัมน์เดียว (แสดงค่าที่มีข้อมูล)",
        before: "ตำแหน่งที่อยู่: (ว่าง) | พิกัด: (ว่าง)",
        after: "ตำแหน่ง/พิกัด: 13.76336, 100.65453",
      },
      {
        type: "improvement",
        text: "Excel summary export (พร้อมรูป): คอลัมน์ 'ผู้นับ' แสดง 'ชื่อจริง [รหัส]' แทน username",
        before: "ผู้นับ: wattchai",
        after: "ผู้นับ: Watthachai Taechalue [BA2171]",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "27 เมษายน 2569",
    title: "Super Admin visibility & Status filter fixes",
    changes: [
      {
        type: "fix",
        text: "Super Admin เห็น 0 sessions ในหน้า Counting Summary — แก้โดยไม่กรองด้วย companyId สำหรับ Super Admin",
        before: "Counting Summary: พบ 0 sessions (กรอง companyId ที่ไม่มี)",
        after: "Counting Summary: แสดงครบทุก sessions ทุกบริษัท",
      },
      {
        type: "fix",
        text: "Sessions ที่ Supervisor อนุมัติแล้ว (status: 'approved') ไม่แสดงในสรุป — แก้โดยรวม 'approved' ในทุก filter",
        before: "filter: status === 'completed'",
        after: "filter: status === 'completed' || status === 'approved'",
      },
      {
        type: "fix",
        text: "ReferenceError: userFullNameMap is not defined ใน SessionDetailModal — แก้โดยส่งเป็น props",
        before: "ReferenceError: userFullNameMap is not defined",
        after:
          "ส่ง userFullNameMap และ userBaCodeMap เป็น props ให้ SessionDetailModal",
      },
      {
        type: "feature",
        text: "Super Admin เห็นตัวเลือก 'ทุกเดือน' ในตัวกรองเดือน และ default เป็นดูทุกเดือน",
      },
      {
        type: "improvement",
        text: "Footer ของตารางสรุปแสดงข้อความ 'เสร็จสิ้น/อนุมัติแล้ว' สำหรับ Super Admin",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "มีนาคม 2569",
    title: "EOD Integration & รายงาน",
    changes: [
      {
        type: "feature",
        text: "เชื่อมต่อข้อมูล EOD (End-of-Day) จากระบบ Phithan เพื่อเปรียบเทียบยอดนับ",
      },
      {
        type: "feature",
        text: "Excel export แสดงคอลัมน์ EOD Qty, ต่างจาก EOD, วันที่ EOD",
      },
      {
        type: "feature",
        text: "หน้ารายงาน Stock Comparison (เปรียบเทียบยอดนับ vs EOD)",
      },
      {
        type: "feature",
        text: "ระบบ Supervisor Override — Supervisor อนุมัติหรือปฏิเสธผลการนับได้",
      },
      {
        type: "improvement",
        text: "เพิ่ม UOM (Unit of Measure) สำหรับสินค้าประเภทกล่อง แปลงเป็นชิ้นอัตโนมัติ",
      },
      {
        type: "improvement",
        text: "Sheet 'สรุปรวม UOM' ใน Excel export รวมยอดกล่อง × ชิ้น",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "มกราคม 2569",
    title: "เปิดตัวระบบ Stock Counter",
    changes: [
      {
        type: "feature",
        text: "Admin Dashboard สำหรับจัดการรอบการนับสต็อก",
      },
      {
        type: "feature",
        text: "Mobile App สำหรับพนักงานนับสต็อกพร้อม AI Vision",
      },
      {
        type: "feature",
        text: "Export Excel และ PDF พร้อมรูปภาพ watermark",
      },
      {
        type: "feature",
        text: "ระบบจัดการผู้ใช้, สาขา, สินค้า, รอบการนับ",
      },
      {
        type: "feature",
        text: "ระบบ Invitation สำหรับเชิญพนักงานเข้าร่วมบริษัท",
      },
      {
        type: "feature",
        text: "รองรับหลายบริษัท (Multi-tenant) ด้วย Super Admin",
      },
    ],
  },
];
