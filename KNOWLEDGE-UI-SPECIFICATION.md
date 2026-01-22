# Knowledge Base UI Specification

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────────┐
│                         WORKSPACE                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Knowledge Bases                        │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │   │
│  │  │ Product     │  │ FAQ         │  │ Policy      │       │   │
│  │  │ Docs        │  │ Database    │  │ Documents   │       │   │
│  │  │ 📚 5 docs   │  │ ❓ 12 docs  │  │ 📋 3 docs   │       │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      Chatbots                             │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ Customer Support Bot                                 │ │   │
│  │  │ Uses: Product Docs ✓, FAQ ✓                          │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ Internal Bot                                         │ │   │
│  │  │ Uses: Policy Documents ✓                             │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Knowledge Bases List Page

**Route:** `/workspaces/:workspaceId/knowledge`

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Knowledge Bases                                  [+ New Knowledge] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  🔍 Search knowledge bases...                                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📚 Product Documentation                                     │    │
│  │ Technical documentation for all products                      │    │
│  │ 5 documents • 127 chunks • 2.4 MB                            │    │
│  │ Created by john@company.com • 3 days ago                     │    │
│  │                                                  [⚙️] [🗑️]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ ❓ FAQ Database                                               │    │
│  │ Frequently asked questions and answers                        │    │
│  │ 12 documents • 89 chunks • 1.1 MB                            │    │
│  │ Created by admin@company.com • 1 week ago                    │    │
│  │                                                  [⚙️] [🗑️]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// Get all knowledge bases
GET /api/v1/workspaces/:workspaceId/knowledge
Authorization: Bearer <jwt>

// Response
[
  {
    "id": "kb-123",
    "name": "Product Documentation",
    "description": "Technical documentation for all products",
    "icon": "📚",
    "status": "active",
    "document_count": 5,
    "total_chunks": 127,
    "total_size": 2500000,
    "created_by_id": "user-456",
    "created_at": "2026-01-18T10:00:00Z",
    "updated_at": "2026-01-20T15:30:00Z"
  }
]
```

---

## 2. Create Knowledge Base Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│  Create Knowledge Base                                        [✕]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Icon                                                                │
│  [📚] [❓] [📋] [💼] [🔧] [📊] [Custom...]                         │
│                                                                      │
│  Name *                                                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Product Documentation                                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Description                                                         │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Technical documentation for all products                     │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Cancel]                                           [Create]        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// Create knowledge base
POST /api/v1/workspaces/:workspaceId/knowledge
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "name": "Product Documentation",
  "description": "Technical documentation for all products",
  "icon": "📚"
}

// Response: Knowledge object
```

---

## 3. Knowledge Base Detail Page

**Route:** `/workspaces/:workspaceId/knowledge/:knowledgeId`

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Knowledge                                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📚 Product Documentation                              [Edit] [🗑️]  │
│  Technical documentation for all products                           │
│                                                                      │
│  ┌───────────────┬───────────────┬───────────────┐                  │
│  │  5 Documents  │  127 Chunks   │  2.4 MB       │                  │
│  └───────────────┴───────────────┴───────────────┘                  │
│                                                                      │
│  Documents                                       [+ Upload Document] │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📄 product-guide-v2.pdf                                      │    │
│  │ PDF • 1.2 MB • 45 chunks • ✅ Indexed                        │    │
│  │ Uploaded by john@company.com • 2 days ago        [👁️] [🗑️]   │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ 📄 api-reference.pdf                                         │    │
│  │ PDF • 800 KB • 32 chunks • ✅ Indexed                        │    │
│  │ Uploaded by john@company.com • 3 days ago        [👁️] [🗑️]   │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ 📄 getting-started.docx                                      │    │
│  │ DOCX • 250 KB • 18 chunks • 🔄 Indexing (75%)                │    │
│  │ Uploaded by admin@company.com • 1 hour ago       [👁️] [🗑️]   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// Get knowledge base with documents
GET /api/v1/workspaces/:workspaceId/knowledge/:knowledgeId
Authorization: Bearer <jwt>

// Response
{
  "id": "kb-123",
  "name": "Product Documentation",
  "description": "...",
  "status": "active",
  "document_count": 5,
  "total_chunks": 127,
  "total_size": 2500000,
  "documents": [
    {
      "id": "doc-456",
      "file_name": "product-guide-v2.pdf",
      "type": "pdf",
      "size": 1200000,
      "chunk_count": 45,
      "status": "indexed",
      "processing_progress": 100,
      "uploaded_at": "2026-01-18T10:00:00Z",
      "user": { "email": "john@company.com" }
    }
  ]
}
```

---

## 4. Upload Document Flow

### Upload Modal

```
┌─────────────────────────────────────────────────────────────────────┐
│  Upload Document                                              [✕]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                                                              │    │
│  │            📁 Drag & drop files here                         │    │
│  │               or click to browse                             │    │
│  │                                                              │    │
│  │    Supported: PDF, DOCX, TXT, MD, PNG, JPG, WEBP (max 20MB) │    │
│  │    Images: Auto-extracted using Vision AI (OCR + Context)   │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Selected files:                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ 📄 product-guide.pdf (1.2 MB)                          [✕]  │    │
│  │ 📄 faq-list.docx (350 KB)                              [✕]  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Cancel]                                           [Upload]        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Upload Progress

```
┌─────────────────────────────────────────────────────────────────────┐
│  Uploading Documents...                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📄 product-guide.pdf                                               │
│  ████████████████████████████████████████ 100%                      │
│  ✅ Uploaded                                                        │
│                                                                      │
│  📄 faq-list.docx                                                   │
│  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 35%                       │
│  🔄 Processing chunks...                                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// Upload document to knowledge base
POST /api/v1/workspaces/:workspaceId/documents
Authorization: Bearer <jwt>
Content-Type: multipart/form-data

FormData:
  - file: <binary>
  - knowledge_id: "kb-123"
  - file_name: "product-guide.pdf" (optional)

// Response
{
  "id": "doc-789",
  "knowledge_id": "kb-123",
  "file_name": "product-guide.pdf",
  "status": "pending",
  "processing_progress": 0
}

// Listen for processing progress via SSE
GET /api/v1/sse/rag-progress?documentId=doc-789

// SSE Events
data: {"documentId":"doc-789","status":"processing","progress":25,"message":"Extracting text..."}
data: {"documentId":"doc-789","status":"processing","progress":50,"message":"Splitting into chunks..."}
data: {"documentId":"doc-789","status":"processing","progress":75,"message":"Generating embeddings..."}
data: {"documentId":"doc-789","status":"indexed","progress":100,"message":"Done!"}
```

---

## 5. Chatbot Knowledge Selection

**Route:** `/workspaces/:workspaceId/chatbots/:chatbotId/settings`

### Layout (Knowledge Tab)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Chatbot Settings: Customer Support Bot                             │
├─────────────────────────────────────────────────────────────────────┤
│  [General] [Knowledge] [Plugins] [Advanced]                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Knowledge Bases                                                     │
│  Select which knowledge bases this chatbot can access               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ [✓] 📚 Product Documentation                                 │    │
│  │     5 documents • 127 chunks                                 │    │
│  │     Priority: ┌────┐                                         │    │
│  │               │ 1  │ (higher = searched first)               │    │
│  │               └────┘                                         │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ [✓] ❓ FAQ Database                                          │    │
│  │     12 documents • 89 chunks                                 │    │
│  │     Priority: ┌────┐                                         │    │
│  │               │ 2  │                                         │    │
│  │               └────┘                                         │    │
│  ├─────────────────────────────────────────────────────────────┤    │
│  │ [ ] 📋 Policy Documents                                      │    │
│  │     3 documents • 42 chunks                                  │    │
│  │     (Not selected)                                           │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  [Save Changes]                                                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### API

```typescript
// Get chatbot's knowledge bases
GET /api/v1/workspaces/:workspaceId/chatbots/:chatbotId/knowledge
Authorization: Bearer <jwt>

// Response
[
  {
    "knowledge": {
      "id": "kb-123",
      "name": "Product Documentation",
      "icon": "📚",
      "document_count": 5,
      "total_chunks": 127
    },
    "is_enabled": true,
    "priority": 1
  },
  {
    "knowledge": {
      "id": "kb-456",
      "name": "FAQ Database",
      "icon": "❓",
      "document_count": 12,
      "total_chunks": 89
    },
    "is_enabled": true,
    "priority": 2
  }
]

// Add knowledge to chatbot
POST /api/v1/workspaces/:workspaceId/chatbots/:chatbotId/knowledge
{
  "knowledge_id": "kb-123",
  "priority": 1
}

// Update knowledge config
PUT /api/v1/workspaces/:workspaceId/chatbots/:chatbotId/knowledge/:knowledgeId
{
  "is_enabled": false,
  "priority": 2
}

// Batch update
POST /api/v1/workspaces/:workspaceId/chatbots/:chatbotId/knowledge/batch
{
  "items": [
    { "knowledge_id": "kb-123", "is_enabled": true, "priority": 1 },
    { "knowledge_id": "kb-456", "is_enabled": true, "priority": 2 },
    { "knowledge_id": "kb-789", "is_enabled": false }
  ]
}

// Remove knowledge from chatbot
DELETE /api/v1/workspaces/:workspaceId/chatbots/:chatbotId/knowledge/:knowledgeId
```

---

## 6. API Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| **Knowledge Base CRUD** |||
| GET | `/workspaces/:wid/knowledge` | List all knowledge bases |
| GET | `/workspaces/:wid/knowledge/:kid` | Get knowledge with documents |
| POST | `/workspaces/:wid/knowledge` | Create knowledge base |
| PUT | `/workspaces/:wid/knowledge/:kid` | Update knowledge base |
| DELETE | `/workspaces/:wid/knowledge/:kid` | Delete knowledge (and all docs) |
| **Document Upload** |||
| POST | `/workspaces/:wid/documents` | Upload document (requires `knowledge_id`) |
| GET | `/workspaces/:wid/documents/:did` | Get document details |
| DELETE | `/workspaces/:wid/documents/:did` | Delete document |
| **Chatbot Knowledge** |||
| GET | `/workspaces/:wid/chatbots/:cid/knowledge` | Get chatbot's knowledge |
| POST | `/workspaces/:wid/chatbots/:cid/knowledge` | Add knowledge to chatbot |
| PUT | `/workspaces/:wid/chatbots/:cid/knowledge/:kid` | Update settings |
| DELETE | `/workspaces/:wid/chatbots/:cid/knowledge/:kid` | Remove from chatbot |
| POST | `/workspaces/:wid/chatbots/:cid/knowledge/batch` | Batch update |

---

## 7. React Components Example

```tsx
// KnowledgeList.tsx
const KnowledgeList = ({ workspaceId }) => {
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  
  useEffect(() => {
    fetch(`/api/v1/workspaces/${workspaceId}/knowledge`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setKnowledgeBases(data));
  }, [workspaceId]);
  
  return (
    <div className="knowledge-list">
      {knowledgeBases.map(kb => (
        <KnowledgeCard key={kb.id} knowledge={kb} />
      ))}
    </div>
  );
};

// DocumentUpload.tsx
const DocumentUpload = ({ workspaceId, knowledgeId, onSuccess }) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleUpload = async (files: File[]) => {
    setUploading(true);
    
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('knowledge_id', knowledgeId);
      
      const response = await fetch(
        `/api/v1/workspaces/${workspaceId}/documents`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );
      
      const doc = await response.json();
      
      // Listen for indexing progress
      const eventSource = new EventSource(
        `/api/v1/sse/rag-progress?documentId=${doc.id}`
      );
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setProgress(data.progress);
        
        if (data.status === 'indexed' || data.status === 'failed') {
          eventSource.close();
          onSuccess?.();
        }
      };
    }
    
    setUploading(false);
  };
  
  return (
    <Dropzone onDrop={handleUpload}>
      {uploading && <ProgressBar value={progress} />}
    </Dropzone>
  );
};

// ChatbotKnowledgeSettings.tsx
const ChatbotKnowledgeSettings = ({ workspaceId, chatbotId }) => {
  const [allKnowledge, setAllKnowledge] = useState([]);
  const [chatbotKnowledge, setChatbotKnowledge] = useState([]);
  
  // Fetch workspace knowledge bases
  useEffect(() => {
    Promise.all([
      fetch(`/api/v1/workspaces/${workspaceId}/knowledge`).then(r => r.json()),
      fetch(`/api/v1/workspaces/${workspaceId}/chatbots/${chatbotId}/knowledge`).then(r => r.json()),
    ]).then(([all, chatbot]) => {
      setAllKnowledge(all);
      setChatbotKnowledge(chatbot);
    });
  }, []);
  
  const handleToggle = async (knowledgeId, enabled) => {
    await fetch(
      `/api/v1/workspaces/${workspaceId}/chatbots/${chatbotId}/knowledge/${knowledgeId}`,
      {
        method: 'PUT',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_enabled: enabled }),
      }
    );
  };
  
  return (
    <div>
      {allKnowledge.map(kb => {
        const chatbotKb = chatbotKnowledge.find(ck => ck.knowledge.id === kb.id);
        return (
          <KnowledgeToggle
            key={kb.id}
            knowledge={kb}
            enabled={chatbotKb?.is_enabled ?? false}
            priority={chatbotKb?.priority ?? 0}
            onToggle={(enabled) => handleToggle(kb.id, enabled)}
          />
        );
      })}
    </div>
  );
};
```

---

## 8. Document Status Icons

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| pending | ⏳ | Gray | Waiting in queue |
| processing | 🔄 | Blue | Being indexed |
| indexed | ✅ | Green | Ready to search |
| failed | ❌ | Red | Error occurred |

---

## 9. Supported File Types

| Type | Extensions | Processing Method |
|------|------------|-------------------|
| PDF | `.pdf` | pdf-parse (text extraction) |
| Word | `.docx`, `.doc` | mammoth (text extraction) |
| Text | `.txt`, `.md` | Direct read |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif` | **Gemini Vision AI** |

### Image Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         IMAGE UPLOAD                                 │
│  ┌─────────┐      ┌──────────────┐      ┌─────────────────────┐     │
│  │  Image  │ ───▶ │ Gemini Vision│ ───▶ │  Extracted Text     │     │
│  │  File   │      │  (2.0 Flash) │      │  + Description      │     │
│  └─────────┘      └──────────────┘      └─────────────────────┘     │
│                                                   │                  │
│                                                   ▼                  │
│                          ┌─────────────────────────────────────┐    │
│                          │  Chunk → Embed → Store in Qdrant    │    │
│                          └─────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

### What Gemini Vision Extracts:

1. **OCR Text**: All visible text in the image
2. **Document Structure**: Tables, lists, headings
3. **Diagram/Chart Content**: Labels, values, relationships
4. **Handwritten Text**: Transcribed if legible
5. **Context Description**: What the image is about

### Example Use Cases:

| Use Case | Input | Output |
|----------|-------|--------|
| Scanned Document | 📄 PDF scan image | Full text content |
| Whiteboard Photo | 📷 Meeting notes | Transcribed text + structure |
| Screenshot | 🖥️ App screenshot | UI text + description |
| Infographic | 📊 Chart image | Data points + labels |
| Product Image | 🛍️ Product photo | Description + visible text |

### UI for Image Upload

```
┌─────────────────────────────────────────────────────────────────────┐
│  📷 product-screenshot.png                                          │
│  PNG • 1.8 MB • 🔄 Processing with Vision AI...                    │
│  ├─ ⏳ Analyzing image...                                           │
│  ├─ ✅ Extracting text (OCR)                                       │
│  ├─ ⏳ Generating description                                       │
│  └─ ⏳ Creating embeddings                                          │
└─────────────────────────────────────────────────────────────────────┘
```

After processing:

```
┌─────────────────────────────────────────────────────────────────────┐
│  📷 product-screenshot.png                                          │
│  PNG • 1.8 MB • 3 chunks • ✅ Indexed                              │
│                                                                      │
│  📝 Extracted Content Preview:                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ This is a screenshot of a product dashboard showing:        │    │
│  │ - Title: "Sales Overview"                                   │    │
│  │ - Chart showing monthly sales from Jan-Dec 2026            │    │
│  │ - Total Revenue: $1,234,567                                 │    │
│  │ - Top Products table with 5 items...                        │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```
