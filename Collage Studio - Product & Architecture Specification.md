# **Collage Studio \- Product & Architecture Specification**

Version: 0.1

Status: Draft

---

# **1\. Vision**

Collage Studio is a mobile-first visual storytelling platform that allows users to create social media content using professionally designed templates.

The platform consists of:

1. Template Editor (Next.js)  
2. Backend Services (Supabase)  
3. Mobile Application (Flutter)

Templates must be remotely configurable and deployable without requiring mobile app updates.

The Flutter application acts exclusively as a rendering engine and content editor.

---

# **2\. Product Goals**

## **Primary Goals**

* Create story/post/reel templates visually  
* Publish templates instantly  
* Support premium template packs  
* Allow mobile users to customize templates  
* Generate exported images

## **Non Goals (MVP)**

* Real-time collaboration  
* Video rendering  
* AI generation  
* Marketplace for creators

---

# **3\. System Architecture**

## **High Level**

Editor → Template JSON → Supabase → Flutter Renderer

The editor creates template definitions.

The backend stores and distributes template definitions.

The mobile application renders template definitions.

---

# **4\. Core Principle**

Templates are Data.

Templates are not Flutter screens.

Templates are not React components.

Templates are JSON documents interpreted by rendering engines.

---

# **5\. Template Model**

{  
  "id": "fashion\_001",  
  "version": 1,  
  "name": "Fashion Cover",  
  "aspectRatio": "story",  
  "canvas": {  
    "width": 1080,  
    "height": 1920  
  },  
  "layers": \[\]  
}

---

# **6\. Canvas Specification**

Supported formats:

| Type | Size |
| ----- | ----- |
| Story | 1080x1920 |
| Post | 1080x1350 |
| Square | 1080x1080 |

Canvas dimensions are fixed.

Responsive layouts are not supported.

---

# **7\. Layer System**

Every visual element is a Layer.

Supported MVP layer types:

* Image  
* Text  
* Shape  
* Sticker

---

# **8\. Image Layer**

{  
  "id": "img\_01",  
  "type": "image",  
  "slotId": "hero\_image",  
  "x": 0,  
  "y": 0,  
  "width": 1080,  
  "height": 1200,  
  "rotation": 0,  
  "opacity": 1,  
  "borderRadius": 0  
}

---

# **9\. Text Layer**

{  
  "id": "txt\_01",  
  "type": "text",  
  "slotId": "title",  
  "x": 80,  
  "y": 1400,  
  "width": 900,  
  "fontFamily": "Playfair Display",  
  "fontSize": 64,  
  "fontWeight": 700,  
  "color": "\#FFFFFF",  
  "alignment": "left"  
}

---

# **10\. Shape Layer**

{  
  "id": "shape\_01",  
  "type": "shape",  
  "shape": "rectangle",  
  "x": 0,  
  "y": 0,  
  "width": 1080,  
  "height": 1920,  
  "fill": "\#000000"  
}

---

# **11\. Sticker Layer**

{  
  "id": "sticker\_01",  
  "type": "sticker",  
  "assetId": "sticker\_wave",  
  "x": 100,  
  "y": 100,  
  "width": 300,  
  "height": 300  
}

---

# **12\. Slot System**

Slots are placeholders.

Templates never contain user content.

Example:

{  
  "slotId": "cover\_photo"  
}

Flutter injects user content during editing.

---

# **13\. Slot Types**

Supported:

image  
text

Future:

video  
audio

---

# **14\. Template Editor**

Technology:

* Next.js  
* TypeScript  
* React Konva  
* Zustand  
* Tailwind

---

# **15\. Editor Layout**

\+--------------------------------------+  
| Toolbar                              |  
\+-----------+--------------------------+  
| Layers    | Canvas                   |  
|           |                          |  
|           |                          |  
\+-----------+--------------------------+  
| Properties Panel                     |  
\+--------------------------------------+

---

# **16\. Editor Features**

## **MVP**

* Add layer  
* Delete layer  
* Reorder layer  
* Move layer  
* Resize layer  
* Rotate layer  
* Edit properties  
* Create slots  
* Save template

---

# **17\. Layer Tree**

Supports:

* reorder  
* lock  
* hide

Structure:

Background  
Photo  
Title  
Subtitle  
Decoration

---

# **18\. Property Panel**

Must expose all editable layer properties.

Example:

X  
Y  
Width  
Height  
Rotation  
Opacity

---

# **19\. Asset Management**

Supported assets:

* Fonts  
* Stickers  
* Decorations

Assets stored in Supabase Storage.

---

# **20\. Fonts**

Fonts are external resources.

Template references fonts by name.

Flutter downloads missing fonts.

Example:

{  
  "fontFamily": "Playfair Display"  
}

---

# **21\. Template Categories**

Examples:

* Fashion  
* Travel  
* Food  
* Business  
* Wedding  
* Minimal

---

# **22\. Versioning**

Every template contains:

{  
  "version": 1  
}

Version increments on every publish.

---

# **23\. Publishing Flow**

Designer creates template.

Editor validates schema.

Template is saved.

Thumbnail is generated.

Template becomes available to mobile clients.

---

# **24\. Validation Rules**

Template must contain:

* id  
* version  
* name  
* canvas  
* layers

Invalid templates cannot be published.

---

# **25\. Flutter Renderer**

Flutter must support:

ImageLayerRenderer  
TextLayerRenderer  
ShapeLayerRenderer  
StickerLayerRenderer

Renderer must be deterministic.

The same JSON must generate the same visual result on every platform.

---

# **26\. Sync Strategy**

App startup:

1. Download template index  
2. Compare versions  
3. Download missing templates  
4. Cache locally

---

# **27\. Offline Support**

Templates must remain available after download.

Cache storage required.

---

# **28\. Database Schema**

templates

id  
name  
version  
category  
premium  
thumbnail\_url  
template\_json  
created\_at  
updated\_at

---

# **29\. Future Features**

## **Phase 2**

* Animation Layer  
* Video Layer  
* Gradient Layer  
* Masks  
* Frame Presets

## **Phase 3**

* AI-assisted layouts  
* Creator marketplace  
* Community templates

---

# **30\. Success Criteria**

Editor can create templates without code changes.

Flutter can render templates without updates.

New templates can be published and consumed immediately.

Template rendering remains platform-independent.

End of Specification.

