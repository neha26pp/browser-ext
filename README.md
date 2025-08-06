# Gemma 3n-powered Web Accessibility Extension

An intelligent Chrome extension that automatically detects and fixes common web accessibility issues using google's gemma 3n model. The extension identifeis problematic images, form fields and links, then generate appropriate accessibility improvements in real-time. 

## 🌟**Features**

### 📸 **Smart Alt Text Generation**
- Missing Alt Text Detection: Automatically finds images without proper alt text
- AI-Powered Generation: Uses vision AI to analyze images and generate descriptive alt text
- Context-Aware: Considers page context and surrounding content for accurate descriptions
- Classification System: Distinguishes between decorative, simple informative, and complex informative images
- Quality Analysis: Evaluates existing alt text and provides improvement suggestions

### 🏷️ **Form Field Enhancement**
- Missing Labels Detection: Identifies form inputs without proper labeling
- Smart Label Generation: Creates clear, descriptive labels based on field context
- ARIA Support: Adds appropriate ARIA attributes for screen reader compatibility
- Accessibility Scoring: Analyzes form accessibility with detailed scoring (1-10)
- Context Analysis: Understands form structure and field relationships

### 🔗**Link Text Enhancement**
- Vague Link Detection: Finds problematic links like "click here", "read more", "learn more"
- Descriptive Text Generation: Replaces vague text with clear, actionable descriptions
- Destination Analysis: Analyzes link destinations to generate appropriate text
- Accessibility Analysis: Evaluates link clarity and purpose for screen readers
- Context-Sensitive: Considers surrounding content for meaningful improvements

## 🚀 **How It Works**
### **Sequential Processing Architecture**
The extension uses a two-phase approach for each accessibility category:
    - Generation Phase: Identifies and fixes missing accessibility features
    - Analysis Phase: Evaluates all elements (including newly improved ones) for quality

### **AI Integration**
- Local AI Server: Connects to LM Studio running Gemma 3n-4b-it model
- Vision Analysis: Captures screenshots of elements and surrounding context
- Structured Responses: Uses JSON schema for consistent, reliable outputs
- Multi-modal Processing: Combines visual and textual analysis for better results

## 🔧 **Installation & Setup**
### **Prerequisites**
- LM Studio - Download and install from LM Studio
- Gemma 3n-4b-it Model - Download through LM Studio
- Chrome Browser - Extension compatible with Chromium-based browsers

### **Setup Instructions**
1. Configure LM Studio
    - Start LM studio server on port 1234
    - Load Gemma 3n model
2. Install Extension 
    - Clone or download extension files
    - Open Chrome -> Extensions -> Developer Mode
    - Load unpacked extension from folder `browser-ext/dist`
3. Verify Setup
    - Extension icon appears in Chrome toolbar (can be enabled/disabled)
    - LM Studio running on `http://localhost:1234`
    - Test on any webpage with accessibility issues

## 📱 **Usage**
### **Basic Operation**
1. Navigate to any webpage (you can use the `browser-ext/test.html` for testing)
2. Click the extension icon to toggle ON/OFF
3. Watch as the extension automatically:
    - Highlights problematic elements with colored outlines
    - Shows loading indicators during processing 
    - Displays results with visual feedback
    - Logs results in the console

### **Visual Indicators**
- 🟠 Orange Outline: Element being processed for improvements
- 🟢 Green Outline: Successfully improved element
- 🔵 Blue Outline: Element being analyzed for quality
- 🟢 Dark Green: High accessibility score (8+/10)
- 🟡 Yellow: Medium accessibility score (5-7/10)
- 🔴 Red: Poor accessibility score or processing failed

### **Tooltips & Analysis**
- Hover over improved elements to see detailed analysis
- Before/after comparisons for generated content
- Accessibility scores with specific recommendations
- Issue identification and improvement suggestions

## 🛠️ **Technical Details**
### **Architecture**
Extension Structure:
├── Content Script (main logic)
├── Background Script (Chrome APIs)
├── Popup Interface (user controls)
└── AI Integration (LM Studio API)

### **API Integration**
```js
// LM Studio API Configuration
const API_ENDPOINT = 'http://localhost:1234/v1/chat/completions'
const MODEL = 'gemma-3n-4b-it'

// Structured JSON Schema Responses
response_format: {
  type: "json_schema",
  json_schema: {
    name: "accessibility_response",
    strict: true,
    schema: { /* Defined schemas for each feature */ }
  }
}
```

## 📄 **License**
This project is licensed under the MIT License - see the LICENSE file for details.