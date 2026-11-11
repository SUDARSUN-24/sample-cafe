/* =============================================================================
   config.js — EVERYTHING shop-specific lives in this one file.
   -----------------------------------------------------------------------------
   To rebrand for a new shop, edit the values below (search for "CHANGE-ME"),
   then run:   node tools/bake.mjs      (from the project folder)
   Bake copies this content into index.html so it shows up without JavaScript,
   in LINE/Facebook link previews and in Google. If you forget to bake, the
   page still shows the new content (main.js re-renders it in the browser),
   but link previews will show the old text.

   Text that differs by language is written as { th: "…", en: "…" }.
   Text that is the same in both languages can be a plain string.

   ⚠ All content below is FICTIONAL demo content for "Sample Cafe".
     Only put a real shop's details here with the owner's permission.
   ========================================================================== */

window.SHOP_CONFIG = {
  /* ---------------------------------------------------------------- 1. SITE */
  site: {
    url: "https://sample-cafe-bangkok.vercel.app", // CHANGE-ME: final address, no trailing slash
    defaultLang: "th",                            // first language shown to new visitors
    demoNotice: true,                             // CHANGE-ME: set false for a real shop
    credit: { text: "Website by Sun", url: "" },  // footer credit (url optional)
  },

  /* ------------------------------------------------------------ 2. BUSINESS */
  business: {
    name: { th: "แซมเปิล คาเฟ่", en: "Sample Cafe" },         // CHANGE-ME
    monogram: "S",                                           // CHANGE-ME: 1 letter for the favicon
    schemaType: "CafeOrCoffeeShop", // schema.org type: CafeOrCoffeeShop, Bakery, Restaurant, Store…
    tagline: {                                               // CHANGE-ME
      th: "กาแฟคั่วเอง ขนมอบสดทุกเช้า ในมุมเงียบ ๆ ที่หายากนิดหนึ่ง",
      en: "House-roasted coffee and morning bakes, in a quiet corner that's a little hard to find.",
    },
    eyebrow: { th: "กาแฟ · ขนมอบ · ตั้งแต่ปี 2564", en: "Coffee · Bakery · Since 2021" },
    priceRange: "฿฿",
    cuisine: ["Coffee", "Bakery", "Breakfast"],
  },

  /* --------------------------------------------------------------- 3. THEME
     Pick one of the themes below, or copy one and change the colors.
     Every color becomes a CSS variable (see css/shop.generated.css).
     Text colors must keep 4.5:1 contrast with their backgrounds; run
     `node tools/tests/contrast.mjs` after changing them.                     */
  theme: "warmClassic", // CHANGE-ME: "warmClassic" | "modernMinimal" | "freshGreen"
  themes: {
    warmClassic: {
      displayFont: "serif",  // "serif" (Noto Serif Thai) or "sans" (IBM Plex Sans Thai)
      bg: "#FDFAF4",         // page background (cream)
      bgAlt: "#F5ECDA",      // alternate section background
      sand: "#EDE0C4",       // cards, chips, highlights
      ink: "#2B1A0F",        // main text (espresso)
      inkSoft: "#65503F",    // secondary text
      accent: "#6B4236",     // buttons, links, active tab
      accentInk: "#FDFAF4",  // text on accent
      dark: "#2B1A0F",       // dark sections (story, footer)
      onDark: "#FDFAF4",     // text on dark
      onDarkSoft: "#D8C7AE", // secondary text on dark
      glow: "#C08A5B",       // decorative only (never for text)
    },
    modernMinimal: {
      displayFont: "sans",
      bg: "#FAFAF8", bgAlt: "#F0EFEB", sand: "#E3E1DB",
      ink: "#18181A", inkSoft: "#57575C",
      accent: "#2E3A44", accentInk: "#FAFAF8",
      dark: "#18191B", onDark: "#F5F5F3", onDarkSoft: "#B9BABD",
      glow: "#8FA0AD",
    },
    freshGreen: {
      displayFont: "serif",
      bg: "#F8FAF3", bgAlt: "#ECF1E2", sand: "#DCE6CA",
      ink: "#1D2A1F", inkSoft: "#4C5C4E",
      accent: "#3B6647", accentInk: "#F8FAF3",
      dark: "#1E3325", onDark: "#F4F7EE", onDarkSoft: "#C3D2BD",
      glow: "#8DB07C",
    },
  },

  /* ------------------------------------------------------------- 4. CONTACT */
  contact: {
    phone: "+6620000000",          // CHANGE-ME: international format, used for tel: links
    phoneDisplay: "02-000-0000",   // CHANGE-ME: how the number is shown
    line: {
      id: "@samplecafe-demo",                          // CHANGE-ME
      url: "https://line.me/R/ti/p/@samplecafe-demo",  // CHANGE-ME: LINE "add friend" link (also used for the QR code)
    },
    instagram: {
      handle: "samplecafe.demo",                          // CHANGE-ME
      url: "https://www.instagram.com/samplecafe.demo/",  // CHANGE-ME
    },
  },

  /* ------------------------------------------------------------ 5. LOCATION */
  location: {
    address: {                                                         // CHANGE-ME
      th: "ในปั๊มน้ำมันหลังคาเขียว ถนนสุขุมวิท แขวงพระโขนงเหนือ เขตวัฒนา กรุงเทพฯ 10110",
      en: "Inside the green-roof petrol station, Sukhumvit Rd, Phra Khanong Nuea, Watthana, Bangkok 10110",
    },
    // Short address for structured data (Google). Keep it in Thai, as the post office writes it.
    street: "ถนนสุขุมวิท",
    locality: "เขตวัฒนา",
    region: "กรุงเทพมหานคร",
    postalCode: "10110",
    country: "TH",
    geo: { lat: 13.70536, lng: 100.60143 },  // CHANGE-ME: right-click the shop in Google Maps to copy
    // Optional: paste the shop's Google Maps share link. Leave "" to build one from geo.
    mapsUrl: "",
    // The map preview loads only when the visitor taps it.
    // "osm" = OpenStreetMap (no tracking, light). "google" = Google Maps embed.
    // If you change this, check frame-src in netlify.toml allows that site.
    embed: "osm",
    // Step-by-step "how to find us". icon: train | fuel | walk | store | car | bus | stairs
    steps: [
      {
        icon: "train",
        title: { th: "ลง BTS อ่อนนุช ทางออก 2", en: "BTS On Nut, exit 2" },
        text: {
          th: "เดินตรงไปทางซอยสุขุมวิท 79 ประมาณ 300 เมตร (ราว 4 นาที)",
          en: "Walk straight towards Soi Sukhumvit 79 for about 300 m (around 4 minutes).",
        },
      },
      {
        icon: "fuel",
        title: { th: "เข้าปั๊มน้ำมันหลังคาสีเขียว", en: "Turn into the green-roof petrol station" },
        text: {
          th: "อยู่ฝั่งเดียวกับทางออก BTS ถัดจากร้านขายยา ถ้าขับรถมาให้ชิดซ้ายแล้วเลี้ยวเข้าปั๊มได้เลย",
          en: "Same side as the BTS exit, right after the pharmacy. Driving? Keep left and turn straight in.",
        },
      },
      {
        icon: "walk",
        title: { th: "เดินอ้อมไปด้านหลังร้านสะดวกซื้อ", en: "Walk round behind the convenience store" },
        text: {
          th: "ผ่านจุดเติมลมยาง ร้านเราอยู่ติดกับห้องล้างรถ มีต้นมะกอกในกระถางใหญ่ตั้งอยู่หน้าร้าน",
          en: "Past the air pump. We're next to the car wash, with a big potted olive tree outside.",
        },
      },
      {
        icon: "store",
        title: { th: "มองหาเก้าอี้สีส้ม", en: "Look for the orange chairs" },
        text: {
          th: "ถ้าเห็นเก้าอี้สีส้มกับป้ายไม้เล็ก ๆ แปลว่ามาถูกแล้ว เข้ามาได้เลย",
          en: "Orange chairs and a small wooden sign mean you've found us. Come on in.",
        },
        photo: "find-orange-chairs",
      },
    ],
    transit: {
      th: "BTS อ่อนนุช ทางออก 2 เดิน 4 นาที",
      en: "BTS On Nut, exit 2 — a 4-minute walk",
    },
    parking: {
      th: "จอดฟรีในปั๊ม 1 ชั่วโมง ช่องจอดอยู่หลังร้าน",
      en: "Free parking for 1 hour in the station, behind the cafe",
    },
  },

  /* --------------------------------------------------------------- 6. HOURS
     24-hour times. A day can have several ranges, e.g. [["07:00","11:00"],["13:00","18:00"]].
     A range that ends after midnight (["18:00","02:00"]) is fine.
     Empty list [] = closed that day.                                         */
  hours: {
    timeZone: "Asia/Bangkok",
    weekly: {                       // CHANGE-ME
      mon: [["07:30", "18:00"]],
      tue: [["07:30", "18:00"]],
      wed: [],
      thu: [["07:30", "18:00"]],
      fri: [["07:30", "18:00"]],
      sat: [["08:00", "19:00"]],
      sun: [["08:00", "19:00"]],
    },
    closedDates: ["2026-12-31", "2027-01-01"], // special closures, YYYY-MM-DD
    note: {
      th: "หยุดทุกวันพุธ และวันหยุดพิเศษจะแจ้งใน LINE ก่อนเสมอ",
      en: "Closed Wednesdays. Special closures are always announced on LINE first.",
    },
  },

  /* -------------------------------------------------------------- 7. PHOTOS
     Every photo used on the page. The key must match a file in /images-src
     (hero.jpg → "hero"). After adding photos run:  python tools/images.py
     focus = which point to keep when the photo is cropped ("x% y%").        */
  photos: {
    "hero":               { focus: "52% 58%", alt: { th: "บาริสต้ากำลังเทนมลงในขวดโหลกาแฟเย็นบนเคาน์เตอร์ไม้", en: "A barista pouring milk into iced coffee jars on a wooden counter" } },
    "latte":              { focus: "50% 50%", alt: { th: "ลาเต้ร้อนลายใบไม้ในแก้วเซรามิกสีเข้มบนโต๊ะไม้", en: "Hot latte with leaf latte art in a dark ceramic cup on a wooden table" } },
    "iced-coffee":        { focus: "50% 55%", alt: { th: "ลาเต้เย็นในแก้วทรงสูง นมไล่เฉดกับกาแฟ", en: "Iced latte in a tall glass, milk swirling into coffee" } },
    "matcha":             { focus: "45% 45%", alt: { th: "มัทฉะลาเต้ร้อนลายทิวลิปในแก้วสีเขียวอ่อน", en: "Hot matcha latte with tulip latte art in a pale green cup" } },
    "blueberry-cake":     { focus: "50% 55%", alt: { th: "เค้กอัลมอนด์บลูเบอร์รีชิ้นหนาบนจานเซรามิก", en: "A thick slice of almond blueberry cake on a ceramic plate" } },
    "story-kettle":       { focus: "45% 55%", alt: { th: "กาดริปทองแดงบนโต๊ะไม้ในร้าน", en: "A copper pour-over kettle on a wooden cafe table" } },
    "g-arched-windows":   { focus: "50% 50%", alt: { th: "มุมนั่งริมหน้าต่างโค้ง แสงธรรมชาติส่องเข้ามา", en: "Seating by tall arched windows in soft daylight" } },
    "g-cheers":           { focus: "50% 50%", alt: { th: "มือสามคู่ชนแก้วกาแฟลายลาเต้อาร์ต", en: "Three hands clinking cups of latte art together" } },
    "g-pour-over":        { focus: "55% 50%", alt: { th: "บาริสต้าดริปกาแฟด้วยกาคอห่าน", en: "A barista making pour-over coffee with a gooseneck kettle" } },
    "g-coffee-cake":      { focus: "50% 50%", alt: { th: "เค้กกาแฟกับคาปูชิโน่บนโต๊ะไม้", en: "Coffee cake and a cappuccino on a wooden table" } },
    "g-booth":            { focus: "50% 60%", alt: { th: "โซฟาหนังสีเขียวเข้มใต้โคมไฟทองแดง", en: "A dark green leather booth under a copper lamp" } },
    "g-beans":            { focus: "50% 50%", alt: { th: "เมล็ดกาแฟคั่วใหม่", en: "Freshly roasted coffee beans" } },
    "g-drip":             { focus: "50% 50%", alt: { th: "อุปกรณ์ดริปกาแฟบนบาร์", en: "Pour-over brewing gear on the bar" } },
    "g-choux":            { focus: "50% 50%", alt: { th: "ขนมปังสับปะรดอบใหม่กับลาเต้ร้อน", en: "A freshly baked pineapple bun with a hot latte" } },
    "find-orange-chairs": { focus: "45% 60%", alt: { th: "เก้าอี้พับสีส้มหน้าร้าน", en: "Orange folding chairs outside the cafe" } },
  },

  /* ----------------------------------------------------------------- 8. HERO */
  hero: {
    photo: "hero",
    // Optional looping video (muted, plays only if the visitor allows motion).
    // Example: { mp4: "assets/video/hero.mp4", webm: "assets/video/hero.webm" }
    video: null,
  },

  /* ------------------------------------------------------- 9. SIGNATURE ITEMS */
  signature: {
    title: { th: "เมนูที่ต้องลอง", en: "Signatures" },
    intro: {
      th: "สี่แก้วกับหนึ่งชิ้นที่ลูกค้าประจำสั่งซ้ำมากที่สุด",
      en: "The ones our regulars order again and again.",
    },
    items: [
      { photo: "latte", price: 85, badges: ["bestseller"],
        name: { th: "ลาเต้คั่วบ้าน", en: "House Latte" },
        desc: { th: "เมล็ดคั่วกลางจากเชียงราย นมสดเนียน หอมคาราเมล", en: "Medium roast from Chiang Rai, silky milk, caramel notes." } },
      { photo: "iced-coffee", price: 95, badges: ["new"],
        name: { th: "ลาเต้เย็นน้ำตาลมะพร้าว", en: "Iced Palm-Sugar Latte" },
        desc: { th: "หวานกำลังดีด้วยน้ำตาลมะพร้าวจากแม่กลอง", en: "Gently sweet with coconut palm sugar from Mae Klong." } },
      { photo: "matcha", price: 105, badges: ["bestseller"],
        name: { th: "มัทฉะลาเต้", en: "Uji Matcha Latte" },
        desc: { th: "มัทฉะเกรดพิธีชงจากอุจิ ตีสดทุกแก้ว", en: "Ceremonial-grade Uji matcha, whisked to order." } },
      { photo: "blueberry-cake", price: 125, badges: ["veg"],
        name: { th: "เค้กอัลมอนด์บลูเบอร์รี", en: "Almond Blueberry Cake" },
        desc: { th: "อบใหม่ทุกเช้า เนื้อชุ่ม เปรี้ยวหวานจากบลูเบอร์รี", en: "Baked every morning — moist, with bright blueberries." } },
    ],
  },

  /* ----------------------------------------------------------------- 10. MENU
     price: a number, or { hot: 65, iced: 75 } for drinks with two prices.
     badges: "new" | "bestseller" | "veg"                                     */
  menu: {
    title: { th: "เมนูทั้งหมด", en: "Full menu" },
    note: { th: "ราคารวม VAT แล้ว · เปลี่ยนเป็นนมโอ๊ต +15 บาท", en: "Prices include VAT · Oat milk +15 THB" },
    categories: [
      {
        id: "coffee", name: { th: "กาแฟ", en: "Coffee" },
        items: [
          { name: { th: "เอสเปรสโซ", en: "Espresso" }, price: 60, desc: { th: "ช็อตคู่ เข้ม หอม", en: "Double shot, bold and fragrant" } },
          { name: { th: "อเมริกาโน่", en: "Americano" }, price: { hot: 65, iced: 75 } },
          { name: { th: "ลาเต้คั่วบ้าน", en: "House Latte" }, price: { hot: 75, iced: 85 }, badges: ["bestseller"] },
          { name: { th: "คาปูชิโน่", en: "Cappuccino" }, price: { hot: 75, iced: 85 } },
          { name: { th: "เดอร์ตี้", en: "Dirty" }, price: 95, desc: { th: "นมเย็นจัด ราดเอสเปรสโซร้อน ดื่มทันที", en: "Ice-cold milk under a hot espresso shot" } },
          { name: { th: "อเมริกาโน่ส้ม", en: "Orange Americano" }, price: 95, badges: ["bestseller"], desc: { th: "น้ำส้มสายน้ำผึ้งคั้นสด", en: "With fresh-squeezed local orange juice" } },
          { name: { th: "โคลด์บรูน้ำมะพร้าว", en: "Coconut Cold Brew" }, price: 110, badges: ["new"], desc: { th: "สกัดเย็น 18 ชั่วโมง กับน้ำมะพร้าวน้ำหอม", en: "18-hour cold brew with fresh coconut water" } },
        ],
      },
      {
        id: "no-coffee", name: { th: "ไม่ใช่กาแฟ", en: "Not coffee" },
        items: [
          { name: { th: "มัทฉะลาเต้", en: "Uji Matcha Latte" }, price: { hot: 95, iced: 105 }, badges: ["bestseller"] },
          { name: { th: "มัทฉะมะพร้าว", en: "Coconut Matcha" }, price: 115, badges: ["new", "veg"] },
          { name: { th: "ชาไทย", en: "Thai Tea" }, price: { hot: 70, iced: 80 }, desc: { th: "ชาซีลอนต้มเอง หวานน้อยได้", en: "Brewed in-house; ask for less sweet" } },
          { name: { th: "โกโก้", en: "Cocoa" }, price: { hot: 75, iced: 85 } },
          { name: { th: "โซดามะนาวน้ำผึ้ง", en: "Honey Lime Soda" }, price: 75, badges: ["veg"] },
        ],
      },
      {
        id: "bakery", name: { th: "ขนมอบ", en: "Bakery" },
        items: [
          { name: { th: "ครัวซองต์เนยสด", en: "Butter Croissant" }, price: 75, badges: ["veg"] },
          { name: { th: "เพนโอช็อกโกแลต", en: "Pain au Chocolat" }, price: 85, badges: ["veg"] },
          { name: { th: "บาสก์ชีสเค้ก", en: "Basque Cheesecake" }, price: 135, badges: ["bestseller"], desc: { th: "ไหม้ด้านนอก เนียนนุ่มด้านใน", en: "Burnt outside, custardy inside" } },
          { name: { th: "เค้กอัลมอนด์บลูเบอร์รี", en: "Almond Blueberry Cake" }, price: 125, badges: ["new", "veg"] },
          { name: { th: "ชูครีม", en: "Cream Puff" }, price: 65, badges: ["veg"] },
        ],
      },
      {
        id: "breakfast", name: { th: "อาหารเช้า", en: "Breakfast" },
        items: [
          { name: { th: "ครอฟเฟิลไอศกรีม", en: "Croffle & Ice Cream" }, price: 145, badges: ["veg"] },
          { name: { th: "โทสต์ซาวร์โดว์อะโวคาโด", en: "Avocado Sourdough Toast" }, price: 165, badges: ["veg"], desc: { th: "ไข่ดาวเพิ่มได้ +20 บาท", en: "Add a fried egg +20 THB" } },
          { name: { th: "แซนด์วิชแฮมชีสอบ", en: "Toasted Ham & Cheese" }, price: 155 },
        ],
      },
    ],
  },

  /* ---------------------------------------------------------------- 11. STORY */
  story: {
    title: { th: "เรื่องของร้านเล็ก ๆ ในปั๊ม", en: "A small cafe in a petrol station" },
    photo: "story-kettle",
    body: [
      {
        th: "เราเริ่มจากรถเข็นกาแฟคันเดียวหน้าปั๊มน้ำมันเมื่อปี 2564 ลูกค้าประจำที่แวะเติมน้ำมันทุกเช้าคือเหตุผลที่เราย้ายเข้ามาเปิดร้านจริงจังด้านหลังปั๊ม",
        en: "We started in 2021 with one coffee cart outside the petrol station. The regulars who stopped every morning are why we moved into a real shop out back.",
      },
      {
        th: "ทุกวันนี้เรายังคั่วเมล็ดเองทีละน้อย อบขนมก่อนเปิดร้าน และจำชื่อเมนูประจำของทุกคนได้",
        en: "We still roast in small batches, bake before we open, and remember everyone's usual.",
      },
    ],
    signoff: { th: "— แพรและต้น ผู้ก่อตั้ง (ตัวละครสมมุติ)", en: "— Prae & Ton, founders (fictional)" },
  },

  /* -------------------------------------------------------------- 12. GALLERY
     size: "tall" for portrait photos, "wide" for one featured landscape photo. */
  gallery: {
    title: { th: "บรรยากาศในร้าน", en: "Inside the cafe" },
    items: [
      { photo: "g-arched-windows", size: "wide" },
      { photo: "g-booth", size: "tall" },
      { photo: "g-pour-over" },
      { photo: "g-cheers" },
      { photo: "g-coffee-cake" },
      { photo: "g-beans" },
      { photo: "g-drip" },
      { photo: "g-choux" },
    ],
  },

  /* -------------------------------------------------------------- 13. REVIEWS
     ⚠ Never invent reviews for a real shop. Use real reviews only, with the
       reviewer's permission or properly attributed (e.g. "Google review").
       While isSample is true, the page shows a visible "sample text" label,
       and reviews are never added to Google structured data.               */
  reviews: {
    isSample: true, // CHANGE-ME: false only when every review below is real
    title: { th: "ลูกค้าพูดถึงเรา", en: "Kind words" },
    items: [
      { author: { th: "ลูกค้าตัวอย่าง ก.", en: "Sample guest A" }, source: { th: "ข้อความตัวอย่าง", en: "Sample text" },
        quote: { th: "หาร้านยากนิดหนึ่งตอนแรก แต่พอเจอแล้วกลายเป็นร้านประจำ ลาเต้หอมมาก", en: "A little hard to find the first time, but now it's my regular spot. The latte smells amazing." } },
      { author: { th: "ลูกค้าตัวอย่าง ข.", en: "Sample guest B" }, source: { th: "ข้อความตัวอย่าง", en: "Sample text" },
        quote: { th: "แวะเติมน้ำมันแล้วได้กาแฟดี ๆ กลับไปด้วย ที่จอดสะดวก", en: "Filled up the car and left with great coffee. Parking is easy." } },
      { author: { th: "ลูกค้าตัวอย่าง ค.", en: "Sample guest C" }, source: { th: "ข้อความตัวอย่าง", en: "Sample text" },
        quote: { th: "บาสก์ชีสเค้กเนียนมาก พนักงานใจดี จำเมนูเราได้ตั้งแต่ครั้งที่สอง", en: "Silky Basque cheesecake, and the team remembered my order by my second visit." } },
      { author: { th: "ลูกค้าตัวอย่าง ง.", en: "Sample guest D" }, source: { th: "ข้อความตัวอย่าง", en: "Sample text" },
        quote: { th: "มุมริมหน้าต่างนั่งทำงานได้ทั้งบ่าย เงียบและแสงสวย", en: "The window seats are perfect for a quiet afternoon of work." } },
    ],
  },

  /* -------------------------------------------------------------- 14. CONTACT */
  contactSection: {
    title: { th: "แวะมาหา หรือทักไลน์ก่อนก็ได้", en: "Drop by, or say hi on LINE" },
    intro: {
      th: "สั่งล่วงหน้า ถามทาง หรือจองเค้กทั้งก้อน ทักไลน์ได้เลย ตอบไวในเวลาเปิดร้าน",
      en: "Pre-order, ask for directions or reserve a whole cake on LINE. We reply quickly during opening hours.",
    },
  },

  /* ------------------------------------------------------------------ 15. SEO
     title: ~50–60 characters. description: ~120–155 characters.            */
  seo: {
    title: {                                                   // CHANGE-ME
      th: "แซมเปิล คาเฟ่ | กาแฟคั่วเอง ขนมอบสด ใกล้ BTS อ่อนนุช",
      en: "Sample Cafe | House-roasted coffee near BTS On Nut, Bangkok",
    },
    description: {                                             // CHANGE-ME
      th: "คาเฟ่เล็ก ๆ ในปั๊มน้ำมันย่านสุขุมวิท กาแฟคั่วเอง ขนมอบสดทุกเช้า เดินจาก BTS อ่อนนุช 4 นาที มีที่จอดรถ ดูเมนู เวลาเปิด-ปิด และวิธีเดินทาง",
      en: "A small cafe tucked inside a Sukhumvit petrol station. House-roasted coffee, fresh bakes, 4 minutes from BTS On Nut, with parking.",
    },
    ogImage: "og", // generated by tools/images.py from the hero photo
  },

  /* ------------------------------------------------------- 16. VOICE CONCIERGE
     A "Talk to us" button: visitors speak or type in Thai or English, the
     assistant answers out loud, and the page reacts while it talks (shows a
     dish, opens the map, builds a pre-order to send on LINE).
     It is free: it runs in the visitor's browser (the browser's own speech
     recognition and voices), with no account, API key or server. It answers
     only from this file: menu, prices, hours, location, and the faq below.  */
  concierge: {
    enabled: true,                              // false = no button
    agentName: { th: "น้องแซม", en: "Sam" },     // how the assistant introduces itself
    // Extra questions and answers. If what the visitor says contains one of
    // the keys, the assistant gives the answer. Only write what is true.
    faq: [
      { keys: ["wifi", "wi-fi", "ไวไฟ", "อินเทอร์เน็ต", "internet"],                 // CHANGE-ME
        answer: { th: "มี Wi-Fi ฟรีค่ะ ขอรหัสได้ที่เคาน์เตอร์", en: "Yes, there's free Wi-Fi. Ask for the password at the counter." } },
      { keys: ["ปลั๊ก", "ชาร์จ", "ทำงาน", "socket", "plug", "charge", "laptop"],
        answer: { th: "มีปลั๊กไฟที่โต๊ะริมหน้าต่างค่ะ นั่งทำงานได้สบาย", en: "There are power sockets at the window seats, good for working." } },
      { keys: ["จ่าย", "ชำระ", "พร้อมเพย์", "บัตร", "เงินสด", "pay", "card", "cash", "promptpay"],
        answer: { th: "รับเงินสด โอน และ QR พร้อมเพย์ค่ะ", en: "We take cash, bank transfer and PromptPay QR." } },
      { keys: ["ทั้งก้อน", "เค้กวันเกิด", "whole cake", "birthday cake"],
        answer: { th: "เค้กทั้งก้อนสั่งล่วงหน้า 2 วันทางไลน์ได้เลยค่ะ", en: "Whole cakes need 2 days' notice. Please order on LINE." } },
      { keys: ["แพ้", "ถั่ว", "กลูเตน", "allerg", "nut", "gluten", "dairy", "lactose"],
        answer: { th: "เรื่องอาหารที่แพ้ รบกวนสอบถามพนักงานโดยตรงทางไลน์หรือที่ร้านนะคะ ผู้ช่วยอัตโนมัติยืนยันส่วนผสมให้ไม่ได้ค่ะ", en: "For allergies, please check with the team on LINE or at the counter. As an automated assistant I can't confirm ingredients." } },
      { keys: ["เดลิเวอรี่", "ส่งถึงบ้าน", "จัดส่ง", "deliver", "grab", "lineman"],
        answer: { th: "ตอนนี้ยังไม่มีบริการส่งค่ะ สั่งล่วงหน้าแล้วมารับที่ร้านได้ค่ะ", en: "We don't deliver at the moment, but you can pre-order and pick up at the cafe." } },
      { keys: ["จองโต๊ะ", "จองที่", "reserve", "reservation", "book a table"],
        answer: { th: "ร้านไม่รับจองโต๊ะค่ะ มาได้เลย ช่วงเช้าวันธรรมดาที่นั่งว่างเยอะค่ะ", en: "We don't take table reservations; just walk in. Weekday mornings are the quietest." } },
    ],
  },
};
