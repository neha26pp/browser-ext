let isEnabled = true;

// Check if extension is enabled on load
chrome.storage.sync.get(['enabled'], (result) => {
  isEnabled = result.enabled !== false;
  if (isEnabled) {
    highlightImages();
    highlightFormFields();
    highlightLinks(); // ADD THIS LINE
  }
});

// Update the toggle message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggle') {
    isEnabled = request.enabled;
    if (isEnabled) {
      highlightImages();
      highlightFormFields();
      highlightLinks(); // ADD THIS LINE
    } else {
      removeHighlights();
      removeFormHighlights();
      removeLinkHighlights(); // ADD THIS LINE
    }
  }
});

// =============================================================================
// FORM FIELD FUNCTIONALITY
// =============================================================================

async function highlightFormFields() {
  // Find form inputs that need labels/placeholders
  const allInputs = document.querySelectorAll('input, textarea, select');
  const unlabeledInputs = Array.from(allInputs).filter(input => needsLabel(input));
  const labeledInputs = Array.from(allInputs).filter(input => hasExistingLabel(input));
  
  console.log(`Found ${unlabeledInputs.length} form inputs needing labels and ${labeledInputs.length} inputs with existing labels`);
  
  // STEP 1: Process inputs missing labels/placeholders FIRST
  const generationPromises = unlabeledInputs.map(async (input, index) => {
    input.style.outline = "3px solid orange";
    input.classList.add('ai-form-highlight');
    
    const loadingDiv = createLoadingIndicator(input, '🏷️ Generating label/placeholder...');
    
    try {
      const result = await generateFormFieldHelp(input);
      
      // Apply the generated help text
      if (result.label && !hasVisibleLabel(input)) {
        addGeneratedLabel(input, result.label);
      }
      
      if (result.aria_label && !input.getAttribute('aria-label')) {
        input.setAttribute('aria-label', result.aria_label);
      }
      
      input.style.outline = "3px solid green";
      updateLoadingIndicator(loadingDiv, '✅ Form help added', 'rgba(0,128,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
        input.style.outline = "";
      }, 2000);
      
      return { input, success: true };
      
    } catch (error) {
      console.error('Failed to generate form field help:', error);
      input.style.outline = "3px solid red";
      updateLoadingIndicator(loadingDiv, '❌ Failed to generate help', 'rgba(128,0,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
      }, 2000);
      
      return { input, success: false };
    }
  });
  
  // Wait for all generation to complete
  const generationResults = await Promise.all(generationPromises);
  console.log('Form field generation completed');
  
  // STEP 2: Now process ALL inputs (including newly labeled ones) for accessibility analysis
  // Wait a bit for the DOM to settle after label generation
  setTimeout(async () => {
    await analyzeAllFormFields();
  }, 1000);
}

async function analyzeAllFormFields() {
  // Re-query all inputs to include newly labeled ones
  const allInputs = document.querySelectorAll('input, textarea, select');
  const inputsToAnalyze = Array.from(allInputs).filter(input => 
    !input.type || !['hidden', 'submit', 'button', 'reset'].includes(input.type)
  );
  
  console.log(`Starting accessibility analysis for ${inputsToAnalyze.length} form fields`);
  
  // Process inputs for quality analysis
  const analysisPromises = inputsToAnalyze.map(async (input, index) => {
    input.style.outline = "3px solid blue";
    input.classList.add('ai-form-analysis');
    
    const loadingDiv = createLoadingIndicator(input, '🔍 Analyzing form accessibility...');
    
    try {
      const analysis = await analyzeFormFieldAccessibility(input);
      displayFormAccessibilityAnalysis(input, analysis);
      
      if (analysis.accessibility_score >= 8) {
        input.style.outline = "3px solid darkgreen";
        updateLoadingIndicator(loadingDiv, '✅ Form field is accessible', 'rgba(0,100,0,0.8)');
      } else if (analysis.accessibility_score >= 5) {
        input.style.outline = "3px solid orange";
        updateLoadingIndicator(loadingDiv, '⚠️ Form accessibility needs improvement', 'rgba(255,165,0,0.8)');
      } else {
        input.style.outline = "3px solid red";
        updateLoadingIndicator(loadingDiv, '❌ Poor form accessibility', 'rgba(128,0,0,0.8)');
      }
      
      setTimeout(() => {
        loadingDiv.remove();
        input.style.outline = "";
      }, 3000);
      
    } catch (error) {
      console.error('Failed to analyze form accessibility:', error);
      input.style.outline = "3px solid red";
      updateLoadingIndicator(loadingDiv, '❌ Analysis failed', 'rgba(128,0,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
      }, 2000);
    }
  });
  
  await Promise.all(analysisPromises);
  console.log('Form accessibility analysis completed');
}

function needsLabel(input) {
  // Skip hidden, submit, and button inputs
  if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'reset') {
    return false;
  }
  
  // Check if input has a proper VISIBLE label (most important check)
  if (hasVisibleLabel(input)) {
    return false;
  }
  
  // Check if input has aria-label
  if (input.getAttribute('aria-label') && input.getAttribute('aria-label').trim()) {
    return false;
  }
  
  // Check if input has aria-labelledby pointing to valid element
  const ariaLabelledBy = input.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement && labelElement.textContent.trim()) {
      return false;
    }
  }
  
  // IMPORTANT: We removed the placeholder check entirely
  // Placeholders are NOT accessible labels and should not prevent label generation
  // Even if an input has a "meaningful" placeholder, it still needs a proper label
  
  return true; // Needs labeling
}

function hasExistingLabel(input) {
  // Skip hidden, submit, and button inputs
  if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button' || input.type === 'reset') {
    return false;
  }
  
  // Has some form of labeling but might need improvement
  return hasVisibleLabel(input) || 
         (input.placeholder && input.placeholder.trim()) ||
         input.getAttribute('aria-label') ||
         input.getAttribute('aria-labelledby');
}

function hasVisibleLabel(input) {
  // Check for explicit label element
  const labelFor = document.querySelector(`label[for="${input.id}"]`);
  if (labelFor && labelFor.textContent.trim()) {
    return true;
  }
  
  // Check if input is inside a label
  const parentLabel = input.closest('label');
  if (parentLabel && parentLabel.textContent.replace(input.value || '', '').trim()) {
    return true;
  }
  
  return false;
}

function isGenericPlaceholder(text) {
  const generic = ['enter', 'type', 'input', 'text', 'value', '...', 'placeholder'];
  return generic.some(g => text.toLowerCase().includes(g));
}

async function generateFormFieldHelp(inputElement) {
  try {
    // Capture the input field and its context
    const inputImageData = await captureInputField(inputElement);
    const contextImageData = await captureInputWithContext(inputElement);
    
    // const pageContext = getPageContext(inputElement);
    // const formContext = getFormContext(inputElement);
    let inputContext = getInputContext(inputElement);

    // console.log('Form context:', formContext);
    // console.log('Input context:', inputContext);
    
    // Add dropdown options to context if this is a select element
    let dropdownOptions = '';
    if (inputElement.tagName === 'SELECT') {
      const options = Array.from(inputElement.options);
      const optionTexts = options
        .filter(option => option.value && option.textContent.trim())
        .map(option => option.textContent.trim())
        .slice(0, 8);
      
      if (optionTexts.length > 0) {
        dropdownOptions = `\nHere are the select options: ${optionTexts.join(', ')}`;
        inputContext = `\nHere is the input field context: ${inputContext}\nHere are the select options: ${optionTexts.join(', ')}`;
        console.log('Adding dropdown options to context:', dropdownOptions);
      }
    }
    
    const prompt = `You are a web accessibility expert tasked with generating helpful labels, placeholders, and help text for form inputs.

# You will receive:
- Input field screenshot (isolated)
- Input field with surrounding context screenshot

# Your task is to generate a helpful text label and aria-label for the form field.

# Steps:
1. Analyze the form context to understand what data the form is collecting
2. Analyze the input's position and surrounding elements to understand its specific purpose
3. Determine the input type and what kind of data it expects
4. Generate a helpful text label and aria-label for the form field.

# Guidelines:
- Labels should be clear and descriptive (e.g., "Email address", "First name", "Password")
- Consider the input type (e.g., text input, select, date, number, name, email, password, etc.) to generate appropriate labels
  - If the input type is "select", make sure to look at the options in the dropdown list and generate a helpful label for the dropdown.

# Here is the input field context:
${inputContext}

# Examples of good vs bad labels:
- Name (First and Last): Specifies that both first and last names are expected, avoiding ambiguity.
- Email Address: Clearly indicates the field expects an email.
- Phone Number (with area code): Specifies the format or part of the number expected.
- Password (at least 8 characters): Combines the label with a basic requirement to guide users.
- Date of Birth (MM/DD/YYYY): Indicates the expected date format.
- Shipping Address: Clearly identifies the purpose of the input.
- Search: Simple and clear for a search input.
- Select your country: Specifies that the field is a dropdown list of countries instead of just saying "select option"
`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma-3n-4b-it",
        messages: [
          {
            role: "system",
            content: "You are a web accessibility expert who generates helpful form field labels and guidance."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${prompt}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${inputImageData}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${contextImageData}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "form_field_help",
            strict: true,
            schema: {
              type: "object",
              properties: {
                field_purpose: {
                  type: "string",
                  description: "Based on the context analysis, what is the purpose of this field?"
                },
                input_type: {
                  type: "string",
                  description: "What is the type of this field? (e.g., select, text input, date, number, name, email, password, etc.) If input type is select, then list all the options in the list."
                },
                label: {
                  type: "string",
                  description: "Clear, concise label for the field"
                },
                aria_label: {
                  type: "string",
                  description: "ARIA label for screen readers (can be same as label)"
                }
              },
              required: ["field_purpose", "input_type", "label", "aria_label"]
            }
          }
        },
        max_tokens: 300,
        temperature: 0.2,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
    
  } catch (error) {
    console.error('Form field help generation error:', error);
    throw error;
  }
}

async function analyzeFormFieldAccessibility(inputElement) {
  try {
    const inputImageData = await captureInputField(inputElement);
    const contextImageData = await captureInputWithContext(inputElement);
    
    const pageContext = getPageContext(inputElement);
    const formContext = getFormContext(inputElement);
    const inputContext = getInputContext(inputElement);
    
    // Get current accessibility features
    const currentLabel = getCurrentLabel(inputElement);
    const currentPlaceholder = inputElement.placeholder || '';
    const currentAriaLabel = inputElement.getAttribute('aria-label') || '';
    const currentHelpText = getCurrentHelpText(inputElement);
    
    const analysisPrompt = `You are a web accessibility expert analyzing the accessibility quality of a form input field.

# You will receive:
- Page and form context
- Input field details  
- Current accessibility features
- Input field screenshot (isolated)
- Input field with surrounding context screenshot

Your task is to evaluate how accessible this form field is for users with disabilities, particularly screen reader users.

# Analysis Steps:
1. Evaluate the current labeling (visible labels, aria-label, etc.)
2. Assess placeholder text quality and appropriateness
3. Check for helpful guidance or error prevention
4. Consider keyboard accessibility and field identification
5. Rate overall accessibility and identify improvements

# Accessibility Criteria:
- Clear, descriptive labeling that explains the field's purpose
- Appropriate use of placeholders (examples, not labels)
- Helpful guidance for complex fields
- Proper ARIA attributes for screen readers
- Clear error handling and validation messaging
- Logical tab order and keyboard navigation

Current Field State:
- Label: "${currentLabel}"
- Placeholder: "${currentPlaceholder}"
- ARIA Label: "${currentAriaLabel}"
- Help Text: "${currentHelpText}"
- Input Type: ${inputElement.type}
- Required: ${inputElement.required}`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma-3n-4b-it",
        messages: [
          {
            role: "system",
            content: "You are a web accessibility expert who evaluates form field accessibility."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${analysisPrompt}\n\nPage Context: ${pageContext}\nForm Context: ${formContext}\nInput Context: ${inputContext}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${inputImageData}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${contextImageData}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "form_accessibility_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                accessibility_score: {
                  type: "number",
                  description: "Integer score from 1-10 for overall accessibility"
                },
                label_quality: {
                  type: "string",
                  enum: ["excellent", "good", "fair", "poor", "missing"]
                },
                placeholder_appropriateness: {
                  type: "string",
                  enum: ["excellent", "good", "fair", "poor", "not_applicable"]
                },
                issues_found: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "List of accessibility issues identified"
                },
                suggestions: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Specific suggestions for improvement"
                },
                is_accessible: {
                  type: "boolean",
                  description: "Whether the field meets basic accessibility standards"
                },
                reasoning: {
                  type: "string",
                  description: "Explanation of the accessibility assessment"
                }
              },
              required: ["accessibility_score", "label_quality", "placeholder_appropriateness", "issues_found", "suggestions", "is_accessible", "reasoning"]
            }
          }
        },
        max_tokens: 400,
        temperature: 0.2,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
    
  } catch (error) {
    console.error('Form accessibility analysis error:', error);
    throw error;
  }
}


  
 // Helper functions for form field context
function getFormContext(inputElement) {
  const form = inputElement.closest('form');
  const contexts = [];
  
  if (form) {
    // Form title or heading
    const formHeading = form.querySelector('h1, h2, h3, h4, h5, h6');
    if (formHeading) {
      contexts.push(`Form title: ${formHeading.textContent.trim()}`);
    }
    
    // Form action/purpose from action attribute or button text
    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');
    if (submitButton) {
      contexts.push(`Submit action: ${submitButton.textContent || submitButton.value || 'Submit'}`);
    }
    
    // Count other fields to understand form complexity
    const allInputs = form.querySelectorAll('input, textarea, select');
    contexts.push(`Form has ${allInputs.length} total fields`);
    
    // Form fieldsets/sections
    const fieldsets = form.querySelectorAll('fieldset');
    fieldsets.forEach(fieldset => {
      const legend = fieldset.querySelector('legend');
      if (legend) {
        contexts.push(`Section: ${legend.textContent.trim()}`);
      }
    });
  }
  
  return contexts.join('. ').slice(0, 300);
}

function getInputContext(inputElement) {
  const contexts = [];
  
  // Input type and attributes
  contexts.push(`Input type: ${inputElement.type}`);
  if (inputElement.required) contexts.push('Required field');
  if (inputElement.pattern) contexts.push(`Pattern: ${inputElement.pattern}`);
  if (inputElement.maxLength) contexts.push(`Max length: ${inputElement.maxLength}`);
  
  // Position in form
  const form = inputElement.closest('form');
  if (form) {
    const allInputs = Array.from(form.querySelectorAll('input, textarea, select'));
    const position = allInputs.indexOf(inputElement) + 1;
    contexts.push(`Field ${position} of ${allInputs.length}`);
  }
  
  // Surrounding elements
  const fieldset = inputElement.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) {
      contexts.push(`In section: ${legend.textContent.trim()}`);
    }
  }
  
  // Previous/next field context
  const prevInput = getPreviousInput(inputElement);
  if (prevInput) {
    const prevLabel = getCurrentLabel(prevInput);
    if (prevLabel) {
      contexts.push(`Previous field: ${prevLabel}`);
    }
  }
  
  return contexts.join('. ').slice(0, 200);
}

function getCurrentLabel(inputElement) {
  // Try explicit label
  if (inputElement.id) {
    const label = document.querySelector(`label[for="${inputElement.id}"]`);
    if (label) return label.textContent.trim();
  }
  
  // Try parent label
  const parentLabel = inputElement.closest('label');
  if (parentLabel) {
    return parentLabel.textContent.replace(inputElement.value || '', '').trim();
  }
  
  // Try aria-label
  const ariaLabel = inputElement.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  
  // Try aria-labelledby
  const ariaLabelledBy = inputElement.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) return labelElement.textContent.trim();
  }
  
  return '';
}

function getCurrentHelpText(inputElement) {
  // Check for aria-describedby
  const describedBy = inputElement.getAttribute('aria-describedby');
  if (describedBy) {
    const helpElement = document.getElementById(describedBy);
    if (helpElement) return helpElement.textContent.trim();
  }
  
  // Look for nearby help text elements
  const helpSelectors = [
    '.help-text',
    '.form-help',
    '.field-help',
    '[class*="help"]',
    '.hint',
    '.description'
  ];
  
  for (const selector of helpSelectors) {
    const helpElement = inputElement.parentElement?.querySelector(selector);
    if (helpElement) return helpElement.textContent.trim();
  }
  
  return '';
}

function getPreviousInput(inputElement) {
  const form = inputElement.closest('form') || document.body;
  const allInputs = Array.from(form.querySelectorAll('input, textarea, select'));
  const currentIndex = allInputs.indexOf(inputElement);
  return currentIndex > 0 ? allInputs[currentIndex - 1] : null;
}

// UI helper functions for form fields
function addGeneratedLabel(inputElement, labelText) {
  // Create a label element if one doesn't exist
  let label = document.querySelector(`label[for="${inputElement.id}"]`);
  
  if (!label) {
    // Generate ID if input doesn't have one
    if (!inputElement.id) {
      inputElement.id = 'ai-generated-' + Date.now() + Math.random().toString(36).substr(2, 9);
    }
    
    label = document.createElement('label');
    label.setAttribute('for', inputElement.id);
    label.style.cssText = `
      display: block;
      font-weight: bold;
      margin-bottom: 4px;
      color: #2563eb;
      font-size: 14px;
      background: rgba(37, 99, 235, 0.1);
      padding: 2px 6px;
      border-radius: 3px;
      border-left: 3px solid #2563eb;
    `;
    
    // Insert label before the input
    inputElement.parentElement.insertBefore(label, inputElement);
  }
  
  label.textContent = labelText;
  label.setAttribute('data-ai-generated', 'true');
}

function addHelpText(inputElement, helpText) {
  if (!helpText.trim()) return;
  
  const helpId = 'ai-help-' + Date.now() + Math.random().toString(36).substr(2, 9);
  
  const helpElement = document.createElement('div');
  helpElement.id = helpId;
  helpElement.textContent = helpText;
  helpElement.style.cssText = `
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    padding: 4px 8px;
    background: rgba(107, 114, 128, 0.1);
    border-radius: 3px;
    border-left: 2px solid #6b7280;
  `;
  helpElement.setAttribute('data-ai-generated', 'true');
  
  // Insert help text after the input
  inputElement.parentElement.insertBefore(helpElement, inputElement.nextSibling);
  
  // Link the help text to the input for screen readers
  const existingDescribedBy = inputElement.getAttribute('aria-describedby');
  if (existingDescribedBy) {
    inputElement.setAttribute('aria-describedby', `${existingDescribedBy} ${helpId}`);
  } else {
    inputElement.setAttribute('aria-describedby', helpId);
  }
}

function displayFormAccessibilityAnalysis(inputElement, analysis) {
  const tooltip = document.createElement('div');
  
  const currentLabel = getCurrentLabel(inputElement);
  const currentPlaceholder = inputElement.placeholder || '';
  
  // Color code based on accessibility score
  let scoreColor = '#dc3545'; // Red for poor
  if (analysis.accessibility_score >= 8) scoreColor = '#28a745'; // Green for good
  else if (analysis.accessibility_score >= 5) scoreColor = '#ffc107'; // Yellow for okay
  
  tooltip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🏷️ Form Field Accessibility Analysis</div>
    
    <div style="margin-bottom: 8px;">
      <div style="font-size: 10px; color: #ccc;">CURRENT STATE:</div>
      <div style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 3px; font-size: 10px;">
        Label: "${currentLabel}"<br>
        Placeholder: "${currentPlaceholder}"
      </div>
    </div>
    
    <div style="margin-bottom: 8px;">
      <span style="color: ${scoreColor}; font-weight: bold;">Score: ${analysis.accessibility_score}/10</span>
      <span style="margin-left: 10px; font-size: 10px;">
        ${analysis.is_accessible ? "✅ Accessible" : "❌ Needs work"}
      </span>
    </div>
    
    ${analysis.issues_found.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #ffc107;">ISSUES:</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
          ${analysis.issues_found.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${analysis.suggestions.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #28a745;">SUGGESTIONS:</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
          ${analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    <div style="font-size: 9px; opacity: 0.8; margin-top: 8px;">
      ${analysis.reasoning}
    </div>
  `;
  
  tooltip.style.cssText = `
    position: absolute;
    background: #7c3aed;
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 10001;
    max-width: 350px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #a855f7;
  `;
  
  const rect = inputElement.getBoundingClientRect();
  tooltip.style.left = (rect.right + window.scrollX + 10) + 'px';
  tooltip.style.top = (rect.top + window.scrollY) + 'px';
  
  // Adjust position if tooltip would go off screen
  if (rect.right + 370 > window.innerWidth) {
    tooltip.style.left = (rect.left + window.scrollX - 360) + 'px';
  }
  
  document.body.appendChild(tooltip);
  
  // Remove tooltip after 12 seconds
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 12000);
  
  console.log('Form accessibility analysis:', {
    score: analysis.accessibility_score,
    is_accessible: analysis.is_accessible,
    label_quality: analysis.label_quality,
    issues: analysis.issues_found,
    suggestions: analysis.suggestions
  });
}

async function captureInputField(inputElement) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const rect = inputElement.getBoundingClientRect();
      const padding = 10;
      
      canvas.width = Math.max(200, rect.width + padding * 2);
      canvas.height = Math.max(50, rect.height + padding * 2);
      
      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw input border
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, padding, rect.width, rect.height);
      
      // Add input type indicator
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px Arial';
      ctx.fillText(`${inputElement.type.toUpperCase()} INPUT`, padding + 5, padding + 15);
      
      // Add placeholder if exists
      if (inputElement.placeholder) {
        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px Arial';
        ctx.fillText(inputElement.placeholder.substring(0, 25), padding + 5, padding + rect.height - 8);
      }
      
      // Add current value if exists
      if (inputElement.value) {
        ctx.fillStyle = '#000000';
        ctx.font = '12px Arial';
        ctx.fillText(inputElement.value.substring(0, 20), padding + 5, padding + rect.height / 2 + 5);
      }
      
      // Add required indicator
      if (inputElement.required) {
        ctx.fillStyle = '#dc2626';
        ctx.font = 'bold 14px Arial';
        ctx.fillText('*', canvas.width - 20, padding + 15);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      
    } catch (error) {
      console.error('Input field capture error:', error);
      // Fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 300;
      canvas.height = 60;
      
      ctx.fillStyle = '#f9fafb';
      ctx.fillRect(0, 0, 300, 60);
      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(5, 5, 290, 50);
      ctx.fillStyle = '#374151';
      ctx.font = '14px Arial';
      ctx.fillText('Form Input Field', 10, 30);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
  });
}

async function captureInputWithContext(inputElement) {
  return new Promise((resolve, reject) => {
    try {
      const rect = inputElement.getBoundingClientRect();
      const padding = 150;
      
      const contextRect = {
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding),
        width: Math.min(window.innerWidth, rect.width + padding * 2),
        height: Math.min(window.innerHeight, rect.height + padding * 2)
      };
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = Math.min(800, contextRect.width);
      canvas.height = Math.min(600, contextRect.height);
      
      // Fill background
      ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const inputRelativeX = rect.left - contextRect.x;
      const inputRelativeY = rect.top - contextRect.y;
      
      // Add context text elements
      addFormContextText();
      
      // Highlight the target input field
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(inputRelativeX - 2, inputRelativeY - 2, rect.width + 4, rect.height + 4);
      
      function addFormContextText() {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        
        // Get form elements and their positions
        const form = inputElement.closest('form') || document.body;
        const formElements = form.querySelectorAll('label, input, textarea, select, button, legend, h1, h2, h3, h4, h5, h6');
        
        formElements.forEach((el) => {
          const elRect = el.getBoundingClientRect();
          const elX = elRect.left - contextRect.x;
          const elY = elRect.top - contextRect.y + 15;
          
          if (elX >= 0 && elX < canvas.width && elY >= 0 && elY < canvas.height) {
            let text = '';
            
            if (el.tagName === 'LABEL') {
              text = `LABEL: ${el.textContent.trim().slice(0, 25)}`;
            } else if (el.tagName === 'LEGEND') {
              text = `SECTION: ${el.textContent.trim().slice(0, 25)}`;
            } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
              text = `${el.tagName}: ${el.textContent.trim().slice(0, 25)}`;
            } else if (el.tagName === 'BUTTON') {
              text = `BTN: ${el.textContent.trim().slice(0, 20)}`;
            } else if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
              text = `${el.type?.toUpperCase() || el.tagName}: ${el.placeholder || el.value || 'field'}`.slice(0, 25);
            }
            
            if (text && el !== inputElement) {
              ctx.fillStyle = el === inputElement ? '#ef4444' : '#6b7280';
              ctx.font = '12px Arial';
              ctx.fillText(text, elX, elY);
            }
          }
        });
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      
    } catch (error) {
      console.error('Input context capture error:', error);
      // Fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 400;
      canvas.height = 300;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(150, 120, 100, 30);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(148, 118, 104, 34);
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Form Input Context', 200, 200);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    }
  });
}

function removeFormHighlights() {
  // Remove form field highlights
  const highlightedInputs = document.querySelectorAll('.ai-form-highlight, .ai-form-analysis');
  highlightedInputs.forEach(input => {
    input.style.outline = "";
    input.classList.remove('ai-form-highlight', 'ai-form-analysis');
  });
  
  // Remove AI-generated elements
  const aiElements = document.querySelectorAll('[data-ai-generated="true"]');
  aiElements.forEach(el => el.remove());
  
  // Remove form tooltips
  const formTooltips = document.querySelectorAll('[style*="background: #7c3aed"]');
  formTooltips.forEach(tooltip => tooltip.remove());
}

// =============================================================================
// EXISTING IMAGE FUNCTIONALITY (unchanged)
// =============================================================================

async function highlightImages() {
  // Find images with different alt text issues
  const allImages = document.querySelectorAll('img');
  const missingAltImages = Array.from(allImages).filter(img => needsAltText(img));
  const existingAltImages = Array.from(allImages).filter(img => hasExistingAltText(img));
  
  console.log(`Found ${missingAltImages.length} images needing alt text and ${existingAltImages.length} images with existing alt text`);
  
  // STEP 1: Process images missing alt text FIRST
  const generationPromises = missingAltImages.map(async (img, index) => {
    img.style.border = "3px solid orange";
    img.classList.add('ai-alt-highlight');
    
    const loadingDiv = createLoadingIndicator(img, '🤖 Generating alt text...');
    
    try {
      const altText = await generateAltText(img);
      img.setAttribute('alt', altText);
      img.style.border = "3px solid green";
      
      updateLoadingIndicator(loadingDiv, '✅ Alt text added', 'rgba(0,128,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
        img.style.border = "";
      }, 2000);
      
      return { img, success: true };
      
    } catch (error) {
      console.error('Failed to generate alt text:', error);
      img.style.border = "3px solid red";
      updateLoadingIndicator(loadingDiv, '❌ Failed to generate', 'rgba(128,0,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
      }, 2000);
      
      return { img, success: false };
    }
  });
  
  // Wait for all alt text generation to complete
  const generationResults = await Promise.all(generationPromises);
  console.log('Alt text generation completed');
  
  // STEP 2: Now analyze ALL images (including newly labeled ones) for quality
  // Wait a bit for the DOM to settle after alt text generation
  setTimeout(async () => {
    await analyzeAllImages();
  }, 1000);
}

async function analyzeAllImages() {
  // Re-query all images to include newly alt-texted ones
  const allImages = document.querySelectorAll('img');
  const imagesToAnalyze = Array.from(allImages).filter(img => hasExistingAltText(img));
  
  console.log(`Starting accessibility analysis for ${imagesToAnalyze.length} images with alt text`);
  
  // Process images with existing alt text for quality analysis
  const analysisPromises = imagesToAnalyze.map(async (img, index) => {
    img.style.border = "3px solid blue";
    img.classList.add('ai-alt-analysis');
    
    const loadingDiv = createLoadingIndicator(img, '🔍 Analyzing existing alt text...');
    
    try {
      const analysis = await analyzeExistingAltText(img);
      displayAltTextAnalysis(img, analysis);
      
      if (analysis.is_sufficient) {
        img.style.border = "3px solid darkgreen";
        updateLoadingIndicator(loadingDiv, '✅ Alt text is good', 'rgba(0,100,0,0.8)');
      } else {
        img.style.border = "3px solid orange";
        updateLoadingIndicator(loadingDiv, '⚠️ Alt text needs improvement', 'rgba(255,165,0,0.8)');
      }
      
      setTimeout(() => {
        loadingDiv.remove();
        img.style.border = "";
      }, 3000);
      
    } catch (error) {
      console.error('Failed to analyze alt text:', error);
      img.style.border = "3px solid red";
      updateLoadingIndicator(loadingDiv, '❌ Analysis failed', 'rgba(128,0,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
      }, 2000);
    }
  });
  
  await Promise.all(analysisPromises);
  console.log('Alt text analysis completed');
}

function hasExistingAltText(img) {
  // Check if image has some form of alt text that isn't generic
  const alt = img.getAttribute('alt');
  const ariaLabel = img.getAttribute('aria-label');
  
  // Has alt text that isn't empty, generic, or obviously bad
  if (alt && alt.trim() && !isGenericAltText(alt)) {
    return true;
  }
  
  if (ariaLabel && ariaLabel.trim() && !isGenericAltText(ariaLabel)) {
    return true;
  }
  
  return false;
}

async function analyzeExistingAltText(imgElement) {
  try {
    // Capture both images like in generation
    const isolatedImageData = await captureImageOnly(imgElement);
    const contextImageData = await captureImageWithContext(imgElement);
    
    const pageContext = getPageContext(imgElement);
    const surroundingText = getSurroundingText(imgElement);
    
    // Get current alt text
    const currentAltText = imgElement.getAttribute('alt') || imgElement.getAttribute('aria-label') || '';
    
    const analysisPrompt = `You are a web accessibility expert analyzing the quality of existing alt text of images on a webpage.

# You will receive:
- Page title
- Page context
- Image (the image with existing alt text)
- Image with surrounding content (the image with 3x margin)

Your task is to evaluate how well the current alt text describes the image and serves accessibility needs.
# Steps:
1. Analyze the page context to understand the main purpose of this page, core themes being discussed and the target audience.
2. Analyze the context surrounding the image to understand the role of the image in the page (e.g., magnifying glass as search input label, a logo in navigation, neighboring text descriptions that provide context, positioning/size in relation to other elements that are used for communication, or if the image is part of a larger interactive element like a button)
3. Classify the image as one of the following categories:
   1. Decorative image:
    - The image adds visual appeal but conveys no meaningful information relevant to the content independently.
    - If this image is removed, the user wouldn't lose any understanding because its meaning is fully conveyed by accompanying text or other elements.
    - Often consists of spacers, borders, abstract background images, or icons that are redundant/next to visible text.
    - If the image is an icon or part of a larger component and its function is entirely clear from nearby text, it is likely decorative
    - Examples: Horizontal rules, purely asthetic patterns, icons where the text label is also present (e.g., a "search/magnifying glass" icon next to the world "Search", background textures) 
   2. Simple Informative image:
    - The image conveys specific information or meaning essentail to understanding the content
    - If removed, meaning would be lost
    - Depicts a concrete object, person, scene or concept
    - Its information can be concisely conveyed in a short phrase or sentence
    - If the image conveys unique information present in the accompanying text or is the sole visual represenattion of a concept, it is likely simple informative   
    - Examples: A product photo on an e-commerce site, a headshot of a person mentioned in a text, an image of a specific toool being discussed, a photo illustrating an event
   3. Complex Informative image (chart/graph/infographic etc.):
    - Presents complex data, relationships, processes, or structured information that requires more than a short description for full understanding
    - Often contains multiple data points, labels or interconnected elements
    - Examples: bar charts, line graphs, pie charts, scatter plots, flow diagrams, maps conveying specific data, detailed infographics, schematics, complex diagrams
  4. Alt text analysis:
    Remember the following
    - If the image is decorative, the alt text should be empty
    - If the image is simple informative, the alt text should be a concise description of the image
    - If the image is complex informative, the alt text should be a concise description of the image and a message that a more complete alternative exists below the image
    - For informative images, consider the following:
      - Does it accurately describe what's visible in the image?
      - Does it provide the right level of detail for the context?
      - Does it avoid redundancy with surrounding text?
    - Analyze both the raw image and the image in context to make your assessment.

IMPORTANT: Your job is to only assess the quality of the alt text, not to generate a new alt text.
`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma-3n-4b-it",
        messages: [
          {
            role: "system",
            content: "You are a web accessibility expert who evaluates alt text quality."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${isolatedImageData}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${contextImageData}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "alt_text_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                page_context: {
                  type: "string",
                  description: "The context of the page"
                },
                surrounding_context: {
                  type: "string",
                  description: "The context surrounding the image"
                },
                classification: {
                  type: "string",
                  enum: ["decorative", "simple_informative", "complex_informative"]
                },
                alt_text_analysis: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  description: "Analyze the alt text based on the context and the classification of the image."
                },
                is_sufficient: {
                  type: "boolean",
                  description: "Whether the alt text is sufficient for accessibility"
                },
              },
              required: ["page_context", "surrounding_context", "classification", "alt_text_analysis", "is_sufficient"]
            }
          }
        },
        max_tokens: 300,
        temperature: 0.2,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
    
  } catch (error) {
    console.error('Alt text analysis error:', error);
    throw error;
  }
}

function displayAltTextAnalysis(imgElement, analysis) {
  // Create detailed analysis tooltip
  const tooltip = document.createElement('div');
  
  const currentAltText = imgElement.getAttribute('alt') || imgElement.getAttribute('aria-label') || '';
  
  // Color code based on quality score
  let scoreColor = '#dc3545'; // Red for poor
  if (analysis.quality_score >= 8) scoreColor = '#28a745'; // Green for good
  else if (analysis.quality_score >= 5) scoreColor = '#ffc107'; // Yellow for okay
  
  tooltip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔍 Alt Text Quality Analysis</div>
    
    <div style="margin-bottom: 8px;">
      <div style="font-size: 10px; color: #ccc;">CURRENT ALT TEXT:</div>
      <div style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 3px; font-style: italic;">
        "${currentAltText}"
      </div>
    </div>
    
    <div style="margin-bottom: 8px;">
      <span style="color: ${scoreColor}; font-weight: bold;">Score: ${analysis.is_sufficient ? "✅" : "❌"}</span>
      <span style="margin-left: 10px; font-size: 10px;">
        ${analysis.classification}
      </span>
    </div>
    
     ${analysis.is_sufficient ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #28a745;">ANALYSIS:</div>
        <div style="background: rgba(40,167,69,0.2); padding: 4px; border-radius: 3px; font-size: 10px;">
          The alt text is sufficient for accessibility
        </div> 
      </div>
    ` : ''}

    ${analysis.alt_text_analysis && analysis.alt_text_analysis.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #ffc107;">ANALYSIS:</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
          ${analysis.alt_text_analysis.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    <div style="font-size: 9px; opacity: 0.8; margin-top: 8px;">
      Classification: ${analysis.classification}
    </div>
  `;
  
  tooltip.style.cssText = `
    position: absolute;
    background: #1e3a8a;
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 10001;
    max-width: 350px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #3b82f6;
  `;
  
  const rect = imgElement.getBoundingClientRect();
  tooltip.style.left = (rect.right + window.scrollX + 10) + 'px';
  tooltip.style.top = (rect.top + window.scrollY) + 'px';
  
  // Adjust position if tooltip would go off screen
  if (rect.right + 370 > window.innerWidth) {
    tooltip.style.left = (rect.left + window.scrollX - 360) + 'px';
  }
  
  document.body.appendChild(tooltip);
  
  // Remove tooltip after 12 seconds
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 12000);
  
  console.log('Alt text analysis:', {
    current: currentAltText,
    is_sufficient: analysis.is_sufficient,
    classification: analysis.classification,
    analysis: analysis.alt_text_analysis
  });
}

function createLoadingIndicator(element, message) {
  const loadingDiv = document.createElement('div');
  loadingDiv.textContent = message;
  loadingDiv.style.cssText = `
    position: absolute;
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    pointer-events: none;
  `;
  
  const rect = element.getBoundingClientRect();
  loadingDiv.style.left = (rect.left + window.scrollX) + 'px';
  loadingDiv.style.top = (rect.top + window.scrollY) + 'px';
  document.body.appendChild(loadingDiv);
  
  return loadingDiv;
}

function updateLoadingIndicator(loadingDiv, message, backgroundColor) {
  loadingDiv.textContent = message;
  loadingDiv.style.background = backgroundColor;
}

async function generateAltText(imgElement) {
  // Skip if image is too small (likely decorative)
  if (imgElement.naturalWidth < 50 || imgElement.naturalHeight < 50) {
    return 'Decorative image';
  }
  
  try {
    // Capture the isolated image
    const isolatedImageData = await captureImageOnly(imgElement);
    
    // Capture the image with surrounding context
    const contextImageData = await captureImageWithContext(imgElement);
    
    // Get page context for better alt text
    const pageContext = getPageContext(imgElement);
    const surroundingText = getSurroundingText(imgElement);

    // generate prompt (keeping your exact prompt unchanged)
    const prompt = `You are a web accessibility expert tasked with generating alt text for images. 
    # You will receive:
    - Page Title
    - Page context
    - Image (the image with missing alt text)
    - Image with surrounding content (the image with 3x margin)

    Your task is to generate a concise, descriptive alt text for this image for web accessibility. Focus on the main subject and important visual details that would help a screen reader user understand the image's content and purpose. Always keep the context in mind.

    # Steps:
    1. Analyze the page context to understand the main purpose of this page, core themes being discussed and the target audience.
    2. Analyze the context surrounding the image to understand the role of the image in the page (e.g., magnifying glass as search input label, a logo in navigation, neighboring text descriptions that provide context, positioning/size in relation to other elements that are used for communication, or if the image is part of a larger interactive element like a button)
    3. Classify the image as one of the following categories:
       1. Decorative image:
        - The image adds visual appeal but conveys no meaningful information relevant to the content independently.
        - If this image is removed, the user wouldn't lose any understanding because its meaning is fully conveyed by accompanying text or other elements.
        - Often consists of spacers, borders, abstract background images, or icons that are redundant/next to visible text.
        - If the image is an icon or part of a larger component and its function is entirely clear from nearby text, it is likely decorative
        - Examples: Horizontal rules, purely asthetic patterns, icons where the text label is also present (e.g., a "search/magnifying glass" icon next to the world "Search", background textures)
      2 Simple Informative image:
        - The image conveys specific information or meaning essentail to understanding the content
        - If removed, meaning would be lost
        - Depicts a concrete object, person, scene or concept
        - Its information can be concisely conveyed in a short phrase or sentence
        - If the image conveys unique information present in the accompanying text or is the sole visual represenattion of a concept, it is likely simple informative
        - Examples: A product photo on an e-commerce site, a headshot of a person mentioned in a text, an image of a specific toool being discussed, a photo illustrating an event
      3. Complex Informative image (chart/graph/infographic etc.):
        - Presents complex data, relationships, processes, or structured information that requires more than a short description for full understanding
        - Often contains multiple data points, labels or interconnected elements
        - Examples: bar charts, line graphs, pie charts, scatter plots, flow diagrams, maps conveying specific data, detailed infographics, schematics, complex diagrams
    4. Alt text generation
      - Never add or remove information based on your own beliefs about real-world existence or accuracy
      - If the context is ambiguous or multiple interpretaitons are possible, default to a more generic description
      - Create appropriate alt text for the raw image based on the classification in step 3 and comprehensive context from steps 1 and 2.
      - For simple informative images: generate a concise alt text (maximum 2 sentences, 140 characters preferred) that captures the visual content and any text visible within the image itself
      - For complex informative images: identify the main visual information or data presented. Format this as a concise alt text (maximum 2 sentences, 140 characters preferred) describing what is shown. Append the exact message: A more complete alternative [data table/structured breakdown - choose based on content] exists below this image.
      - For decorative images: provide an empty alt text ""
`;
    
    // LM STUDIO API CALL - Using Gemma 3n with structured output
    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma-3n-4b-it",
        messages: [
          {
            role: "system",
            content: "You are a web accessibility expert specializing in generating alt text for images."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${prompt}\n\nHere is the page title: ${document.title}\nPage context: ${pageContext}\nSurrounding text: ${surroundingText}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${isolatedImageData}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${contextImageData}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "alt_text_response",
            strict: true,
            schema: {
              type: "object",
              properties: {
                classification: {
                  type: "string",
                  enum: ["decorative", "simple_informative", "complex_informative"]
                },
                alt_text: {
                  type: "string",
                  description: "The alt text for the image. Empty string for decorative images."
                },
                reasoning: {
                  type: "string",
                  description: "Brief explanation of why this classification and alt text was chosen."
                }
              },
              required: ["classification", "alt_text", "reasoning"]
            }
          }
        },
        max_tokens: 200,
        temperature: 0.2,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    const structuredResponse = JSON.parse(result.choices[0].message.content);
    
    // Log the full response for debugging
    console.log('Gemma 3n structured response:', structuredResponse);
    
    // Extract just the alt text
    const altText = structuredResponse.alt_text || '';
    
    // Handle decorative images
    if (structuredResponse.classification === 'decorative' || altText === '') {
      return '';
    }
    
    return altText.trim();
    
  } catch (error) {
    console.error('Alt text generation error:', error);
    return 'AI-generated description unavailable';
  }
}

async function captureImageOnly(imgElement) {
  // Handle SVG images specially - check multiple ways to identify SVGs
  const isSVG = imgElement.src && (
    imgElement.src.includes('.svg') || 
    imgElement.src.includes('data:image/svg') ||
    imgElement.tagName === 'svg' ||
    (imgElement.type && imgElement.type.includes('svg'))
  );
  
  if (isSVG) {
    return await captureSVGAsBase64(imgElement);
  }
  
  // For regular images, handle CORS issues
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Create a new image to handle CORS properly
      const img = new Image();
      
      img.onload = function() {
        try {
          // Resize large images
          const maxSize = 800;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Fill white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
          
        } catch (drawError) {
          console.error('Canvas draw error:', drawError);
          // Create fallback image
          createImageFallback();
        }
      };
      
      img.onerror = function() {
        console.error('Image load error for:', imgElement.src);
        createImageFallback();
      };
      
      // Try with CORS first
      img.crossOrigin = 'anonymous';
      img.src = imgElement.src;
      
      // Fallback: if CORS fails, try without CORS after a delay
      setTimeout(() => {
        if (!img.complete) {
          console.log('CORS image loading timeout, trying without CORS');
          const img2 = new Image();
          
          img2.onload = function() {
            try {
              const maxSize = 800;
              let { width, height } = img2;
              if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width *= ratio;
                height *= ratio;
              }
              
              canvas.width = width;
              canvas.height = height;
              
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, width, height);
              
              ctx.drawImage(img2, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
              
            } catch (drawError2) {
              console.error('Second canvas draw error:', drawError2);
              createImageFallback();
            }
          };
          
          img2.onerror = function() {
            console.error('Second image load error');
            createImageFallback();
          };
          
          // Don't set crossOrigin for second attempt
          img2.src = imgElement.src;
        }
      }, 2000);
      
      function createImageFallback() {
        canvas.width = 400;
        canvas.height = 300;
        
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 400, 300);
        
        // Add border
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 396, 296);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Image', 200, 140);
        
        // Add filename if available
        if (imgElement.src) {
          const fileName = imgElement.src.split('/').pop().substring(0, 25);
          ctx.font = '12px Arial';
          ctx.fillText(fileName, 200, 165);
        }
        
        // Add alt text if available
        const alt = imgElement.getAttribute('alt');
        if (alt) {
          ctx.font = '10px Arial';
          ctx.fillText(`Alt: "${alt.substring(0, 30)}"`, 200, 185);
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      }
      
      // Ultimate timeout
      setTimeout(() => {
        createImageFallback();
      }, 10000);
      
    } catch (error) {
      console.error('Image capture error:', error);
      // Final fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 300;
      canvas.height = 200;
      
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 300, 200);
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Image capture failed', 150, 100);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
  });
}

async function captureImageWithContext(imgElement) {
  // Handle SVG images specially for context capture - improved detection
  const isSVG = imgElement.src && (
    imgElement.src.includes('.svg') || 
    imgElement.src.includes('data:image/svg') ||
    imgElement.tagName === 'svg' ||
    (imgElement.type && imgElement.type.includes('svg'))
  );
  
  if (isSVG) {
    // For SVG context, we'll create a simple layout representation
    return await captureSVGContextAsBase64(imgElement);
  }
  
  // For regular images with CORS handling
  return new Promise((resolve, reject) => {
    try {
      const rect = imgElement.getBoundingClientRect();
      
      // Define context area (expand around the image by 3x margin)
      const margin = Math.max(rect.width, rect.height) * 1.5;
      const contextRect = {
        x: Math.max(0, rect.left - margin),
        y: Math.max(0, rect.top - margin), 
        width: Math.min(window.innerWidth, rect.width + (margin * 2)),
        height: Math.min(window.innerHeight, rect.height + (margin * 2))
      };
      
      // Create canvas for context screenshot
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = Math.min(800, contextRect.width);
      canvas.height = Math.min(600, contextRect.height);
      
      // Fill background
      ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Calculate image position in context
      const imgRelativeX = rect.left - contextRect.x;
      const imgRelativeY = rect.top - contextRect.y;
      
      // Add text context first
      addTextContext();
      
      // Load and draw the main image
      const img = new Image();
      
      img.onload = function() {
        try {
          ctx.drawImage(img, imgRelativeX, imgRelativeY, rect.width, rect.height);
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        } catch (drawError) {
          console.error('Context image draw error:', drawError);
          drawImagePlaceholder();
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        }
      };
      
      img.onerror = function() {
        console.error('Context image load error');
        drawImagePlaceholder();
        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      };
      
      // Try with CORS first
      img.crossOrigin = 'anonymous';
      img.src = imgElement.src;
      
      // Fallback without CORS
      setTimeout(() => {
        if (!img.complete) {
          const img2 = new Image();
          img2.onload = function() {
            try {
              ctx.drawImage(img2, imgRelativeX, imgRelativeY, rect.width, rect.height);
              resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            } catch (e) {
              drawImagePlaceholder();
              resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            }
          };
          img2.onerror = function() {
            drawImagePlaceholder();
            resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
          };
          img2.src = imgElement.src;
        }
      }, 2000);
      
      function addTextContext() {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        
        // Get surrounding text elements and their positions
        const textElements = getSurroundingTextElements(imgElement);
        textElements.forEach((textEl) => {
          const textRect = textEl.getBoundingClientRect();
          const textX = textRect.left - contextRect.x;
          const textY = textRect.top - contextRect.y + 15; // Offset for text baseline
          
          if (textX >= 0 && textX < canvas.width && textY >= 0 && textY < canvas.height) {
            const text = textEl.textContent.trim().slice(0, 30);
            ctx.fillText(text, textX, textY);
          }
        });
      }
      
      function drawImagePlaceholder() {
        // If drawing fails, draw a placeholder rectangle
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(imgRelativeX, imgRelativeY, rect.width, rect.height);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(imgRelativeX, imgRelativeY, rect.width, rect.height);
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('IMAGE', imgRelativeX + rect.width/2, imgRelativeY + rect.height/2);
      }
      
      // Ultimate timeout
      setTimeout(() => {
        drawImagePlaceholder();
        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      }, 10000);
      
    } catch (error) {
      console.error('Context capture error:', error);
      // Final fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 400;
      canvas.height = 300;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(150, 100, 100, 100);
      ctx.fillStyle = '#666666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Context Error', 200, 150);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    }
  });
}

// New helper function to convert SVG to base64 using XMLSerializer
async function captureSVGAsBase64(imgElement) {
  return new Promise((resolve, reject) => {
    try {
      // For external SVG files, fetch and convert
      if (imgElement.src && !imgElement.src.startsWith('data:')) {
        fetch(imgElement.src)
          .then(response => response.text())
          .then(svgText => {
            // Create a temporary div to parse the SVG
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgText;
            const svgElement = tempDiv.querySelector('svg');
            
            if (svgElement) {
              // Set dimensions if not present
              if (!svgElement.getAttribute('width') || !svgElement.getAttribute('height')) {
                const rect = imgElement.getBoundingClientRect();
                svgElement.setAttribute('width', rect.width || 200);
                svgElement.setAttribute('height', rect.height || 200);
              }
              
              // Serialize to string
              const serializer = new XMLSerializer();
              const svgString = serializer.serializeToString(svgElement);
              
              // Convert to base64
              const base64 = btoa(svgString);
              const dataUrl = `data:image/svg+xml;base64,${base64}`;
              
              // Create image from data URL and draw to canvas
              const img = new Image();
              img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                const maxSize = 800;
                let width = img.width || 200;
                let height = img.height || 200;
                
                if (width > maxSize || height > maxSize) {
                  const ratio = Math.min(maxSize / width, maxSize / height);
                  width *= ratio;
                  height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Fill white background
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
              };
              
              img.onerror = function() {
                console.log('SVG image creation failed, using fallback');
                createSVGFallback();
              };
              
              img.src = dataUrl;
            } else {
              createSVGFallback();
            }
          })
          .catch(error => {
            console.log('SVG fetch failed:', error);
            createSVGFallback();
          });
      }
      // For inline SVG data URLs
      else if (imgElement.src && imgElement.src.startsWith('data:image/svg')) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxSize = 800;
          let width = img.width || 200;
          let height = img.height || 200;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Fill white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
        
        img.onerror = function() {
          console.log('Inline SVG failed, using fallback');
          createSVGFallback();
        };
        
        img.src = imgElement.src;
      }
      // For actual SVG elements (not img tags)
      else if (imgElement.tagName === 'svg') {
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(imgElement);
        const base64 = btoa(svgString);
        const dataUrl = `data:image/svg+xml;base64,${base64}`;
        
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          const maxSize = 800;
          let width = img.width || 200;
          let height = img.height || 200;
          
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Fill white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        };
        
        img.onerror = function() {
          console.log('Direct SVG serialization failed, using fallback');
          createSVGFallback();
        };
        
        img.src = dataUrl;
      }
      else {
        createSVGFallback();
      }
      
      function createSVGFallback() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 300;
        
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, 400, 300);
        
        // Add border
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 396, 296);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SVG Image', 200, 140);
        
        // Add any available info
        const info = imgElement.getAttribute('alt') || imgElement.getAttribute('title') || '';
        if (info) {
          ctx.font = '12px Arial';
          ctx.fillText(info.substring(0, 30), 200, 170);
        }
        
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      }
      
      // Timeout fallback
      setTimeout(() => {
        createSVGFallback();
      }, 5000);
      
    } catch (error) {
      console.error('SVG XMLSerializer error:', error);
      // Final fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 400;
      canvas.height = 300;
      
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#6c757d';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SVG Image', 200, 150);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
  });
}

// Context capture for SVGs using XMLSerializer
async function captureSVGContextAsBase64(imgElement) {
  return new Promise((resolve, reject) => {
    try {
      const rect = imgElement.getBoundingClientRect();
      const padding = 100;
      
      const contextRect = {
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding), 
        width: Math.min(window.innerWidth - rect.left + padding, rect.width + (padding * 2)),
        height: Math.min(window.innerHeight - rect.top + padding, rect.height + (padding * 2))
      };
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = Math.min(800, contextRect.width);
      canvas.height = Math.min(600, contextRect.height);
      
      // Fill background
      ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const imgRelativeX = Math.max(0, rect.left - contextRect.x);
      const imgRelativeY = Math.max(0, rect.top - contextRect.y);
      const imgWidth = Math.min(rect.width, canvas.width - imgRelativeX);
      const imgHeight = Math.min(rect.height, canvas.height - imgRelativeY);
      
      // Add surrounding text context first
      addTextContext();
      
      // Handle SVG based on type
      if (imgElement.src && !imgElement.src.startsWith('data:')) {
        // External SVG file
        fetch(imgElement.src)
          .then(response => response.text())
          .then(svgText => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = svgText;
            const svgElement = tempDiv.querySelector('svg');
            
            if (svgElement) {
              const serializer = new XMLSerializer();
              const svgString = serializer.serializeToString(svgElement);
              const base64 = btoa(svgString);
              const dataUrl = `data:image/svg+xml;base64,${base64}`;
              
              const img = new Image();
              img.onload = function() {
                ctx.drawImage(img, imgRelativeX, imgRelativeY, imgWidth, imgHeight);
                resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
              };
              img.onerror = function() {
                drawSVGPlaceholder();
                resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
              };
              img.src = dataUrl;
            } else {
              drawSVGPlaceholder();
              resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
            }
          })
          .catch(() => {
            drawSVGPlaceholder();
            resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
          });
      } else if (imgElement.src && imgElement.src.startsWith('data:image/svg')) {
        // Inline SVG data URL
        const img = new Image();
        img.onload = function() {
          ctx.drawImage(img, imgRelativeX, imgRelativeY, imgWidth, imgHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
        img.onerror = function() {
          drawSVGPlaceholder();
          resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        };
        img.src = imgElement.src;
      } else {
        drawSVGPlaceholder();
        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      }
      
      function addTextContext() {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        ctx.textAlign = 'left';
        
        const textElements = getSurroundingTextElements(imgElement);
        textElements.forEach((textEl) => {
          const textRect = textEl.getBoundingClientRect();
          const textX = Math.max(0, textRect.left - contextRect.x);
          const textY = Math.max(15, textRect.top - contextRect.y + 15);
          
          if (textX < canvas.width && textY < canvas.height) {
            const text = textEl.textContent.trim().slice(0, 30);
            ctx.fillText(text, textX, textY);
          }
        });
      }
      
      function drawSVGPlaceholder() {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(imgRelativeX, imgRelativeY, imgWidth, imgHeight);
        ctx.strokeStyle = '#dee2e6';
        ctx.lineWidth = 1;
        ctx.strokeRect(imgRelativeX, imgRelativeY, imgWidth, imgHeight);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('SVG', imgRelativeX + imgWidth/2, imgRelativeY + imgHeight/2);
      }
      
      // Timeout fallback
      setTimeout(() => {
        drawSVGPlaceholder();
        resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      }, 5000);
      
    } catch (error) {
      console.error('SVG context XMLSerializer error:', error);
      // Final fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 400;
      canvas.height = 300;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(150, 100, 100, 100);
      ctx.fillStyle = '#666666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('SVG Context', 200, 150);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    }
  });
}

function getSurroundingTextElements(imgElement) {
  // Find text elements near the image for context screenshot
  const rect = imgElement.getBoundingClientRect();
  const padding = 100;
  
  const nearbyElements = [];
  const textSelectors = 'p, h1, h2, h3, h4, h5, h6, span, div, a, button, label';
  const textElements = document.querySelectorAll(textSelectors);
  
  textElements.forEach(el => {
    if (el.contains(imgElement) || imgElement.contains(el)) return; // Skip parent/child relationships
    
    const elRect = el.getBoundingClientRect();
    
    // Check if element is near the image
    const isNearby = (
      elRect.right >= rect.left - padding &&
      elRect.left <= rect.right + padding &&
      elRect.bottom >= rect.top - padding &&
      elRect.top <= rect.bottom + padding
    );
    
    if (isNearby && el.textContent.trim() && el.offsetWidth > 0 && el.offsetHeight > 0) {
      nearbyElements.push(el);
    }
  });
  
  return nearbyElements.slice(0, 5); // Limit to 5 nearest text elements
}

function getSurroundingText(imgElement) {
  const contexts = [];
  
  // Get text from parent container
  const parent = imgElement.parentElement;
  if (parent) {
    // Get all text nodes in parent, excluding the image itself
    const walker = document.createTreeWalker(
      parent,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.trim() && !imgElement.contains(node)) {
        textNodes.push(node.textContent.trim());
      }
    }
    
    if (textNodes.length > 0) {
      contexts.push(textNodes.join(' ').slice(0, 200));
    }
  }
  
  // Get button/link text if image is inside interactive element
  const button = imgElement.closest('button, a');
  if (button) {
    const buttonText = button.textContent.replace(imgElement.alt || '', '').trim();
    if (buttonText) {
      contexts.push(`Button/Link text: "${buttonText}"`);
    }
  }
  
  // Get figure caption
  const figure = imgElement.closest('figure');
  if (figure) {
    const caption = figure.querySelector('figcaption');
    if (caption) {
      contexts.push(`Caption: "${caption.textContent.trim()}"`);
    }
  }
  
  // Get aria-describedby content
  const describedBy = imgElement.getAttribute('aria-describedby');
  if (describedBy) {
    const descElement = document.getElementById(describedBy);
    if (descElement) {
      contexts.push(`Description: "${descElement.textContent.trim()}"`);
    }
  }
  
  return contexts.join('. ').slice(0, 300);
}

function getPageContext(imgElement) {
  const contexts = [];
  
  // Page title and purpose
  if (document.title) {
    contexts.push(`Page: ${document.title}`);
  }
  
  // Meta description for page purpose
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    contexts.push(`Purpose: ${metaDesc.content.slice(0, 100)}`);
  }
  
  // Main heading for context
  const mainHeading = document.querySelector('h1');
  if (mainHeading) {
    contexts.push(`Main heading: ${mainHeading.textContent.trim()}`);
  }
  
  // Section heading (closest heading above the image)
  const sectionHeading = imgElement.closest('section, article, div')?.querySelector('h1, h2, h3, h4, h5, h6');
  if (sectionHeading && sectionHeading !== mainHeading) {
    contexts.push(`Section: ${sectionHeading.textContent.trim()}`);
  }
  
  // Page type detection
  const pageTypes = [];
  if (document.querySelector('form')) pageTypes.push('form page');
  if (document.querySelector('.product, [class*="product"]')) pageTypes.push('product page');
  if (document.querySelector('article')) pageTypes.push('article page');
  if (document.querySelector('nav')) pageTypes.push('navigation present');
  
  if (pageTypes.length > 0) {
    contexts.push(`Page type: ${pageTypes.join(', ')}`);
  }
  
  return contexts.join('. ').slice(0, 400);
}

function getImagePosition(imgElement) {
  const rect = imgElement.getBoundingClientRect();
  const parent = imgElement.parentElement;
  
  let position = [];
  
  // Relative size
  if (rect.width < 50 || rect.height < 50) {
    position.push('small icon');
  } else if (rect.width > 300 || rect.height > 300) {
    position.push('large image');
  }
  
  // Position on page
  if (rect.top < window.innerHeight * 0.2) {
    position.push('top of page');
  } else if (rect.top > window.innerHeight * 0.8) {
    position.push('bottom of page');
  }
  
  // Context within parent
  if (parent) {
    const siblings = Array.from(parent.children);
    const imgIndex = siblings.indexOf(imgElement);
    
    if (imgIndex === 0) {
      position.push('first in container');
    } else if (imgIndex === siblings.length - 1) {
      position.push('last in container');
    }
    
    // Check if in button/link
    if (parent.tagName === 'BUTTON' || parent.tagName === 'A') {
      position.push(`inside ${parent.tagName.toLowerCase()}`);
    }
  }
  
  return position.join(', ');
}

function removeHighlights() {
  const highlightedImages = document.querySelectorAll('.ai-alt-highlight, .ai-alt-analysis');
  highlightedImages.forEach(img => {
    img.style.border = "";
    img.classList.remove('ai-alt-highlight', 'ai-alt-analysis');
  });
  
  // Remove any existing tooltips
  const tooltips = document.querySelectorAll('[style*="z-index: 10001"]');
  tooltips.forEach(tooltip => tooltip.remove());
}

function needsAltText(img) {
  // Check if image has meaningful alt text
  const alt = img.getAttribute('alt');
  if (alt && alt.trim() && !isGenericAltText(alt)) {
    return false; // Has good alt text
  }
  
  // Check if image has aria-label
  const ariaLabel = img.getAttribute('aria-label');
  if (ariaLabel && ariaLabel.trim() && !isGenericAltText(ariaLabel)) {
    return false; // Has good aria-label
  }
  
  // Check if image has aria-labelledby pointing to valid element
  const ariaLabelledBy = img.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement && labelElement.textContent.trim()) {
      return false; // Has valid aria-labelledby
    }
  }
  
  // Check if image is explicitly decorative
  if (alt === '' || img.hasAttribute('role') && img.getAttribute('role') === 'presentation') {
    return false; // Intentionally decorative
  }
  
  return true; // Needs alt text
}

function isGenericAltText(text) {
  const generic = ['image', 'photo', 'picture', 'img', 'graphic', 'icon'];
  return generic.includes(text.toLowerCase().trim());
}

// =============================================================================
// SMART LINK TEXT ENHANCEMENT FUNCTIONALITY
// =============================================================================

async function highlightLinks() {
  // Find links with different text quality issues
  const allLinks = document.querySelectorAll('a[href], button[onclick], button[data-href]');
  const vagueLinkTexts = Array.from(allLinks).filter(link => needsBetterLinkText(link));
  
  console.log(`Found ${vagueLinkTexts.length} links needing better text`);
  
  // STEP 1: Process links with vague text FIRST
  const generationPromises = vagueLinkTexts.map(async (link, index) => {
    link.style.outline = "3px solid orange";
    link.classList.add('ai-link-highlight');
    
    const loadingDiv = createLoadingIndicator(link, '🔗 Generating descriptive link text...');
    
    try {
      const result = await generateLinkText(link);
      console.log('Generated link text:', result);
      
      // Apply the generated link text
      if (result.suggested_text) {
        addGeneratedLinkText(link, result.suggested_text);
      }
      
      if (result.aria_label && !link.getAttribute('aria-label')) {
        link.setAttribute('aria-label', result.aria_label);
      }
      
      link.style.outline = "3px solid green";
      updateLoadingIndicator(loadingDiv, '✅ Link text improved', 'rgba(0,128,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
        link.style.outline = "";
      }, 2000);
      
      return { link, success: true };
      
    } catch (error) {
      console.error('Failed to generate link text:', error);
      link.style.outline = "3px solid red";
      updateLoadingIndicator(loadingDiv, '❌ Failed to generate text', 'rgba(128,0,0,0.8)');
      
      setTimeout(() => {
        loadingDiv.remove();
      }, 2000);
      
      return { link, success: false };
    }
  });
  
  // Wait for all generation to complete
  const generationResults = await Promise.all(generationPromises);
  console.log('Link text generation completed');
  
  // STEP 2: Now analyze ALL links (including newly improved ones) for quality
  // Wait a bit for the DOM to settle after text generation
  setTimeout(async () => {
    await analyzeAllLinks();
  }, 1000);
}

function needsBetterLinkText(link) {
  const linkText = getLinkText(link);
  
  // Skip if no text at all (likely icon-only links)
  if (!linkText || !linkText.trim()) {
    return false;
  }
  
  // Check for vague link text patterns
  const vaguePatterns = [
    'click here', 'here', 'read more', 'learn more', 'more', 'continue',
    'go', 'view', 'see', 'check', 'find out', 'discover', 'explore',
    'download', 'get', 'try', 'start', 'begin', 'next', 'previous',
    'back', 'forward', 'submit', 'send', 'contact', 'call', 'email',
    'link', 'button', 'this', 'that', 'it', 'details', 'info',
    'page', 'site', 'website', 'portal', 'platform', 'tool'
  ];
  
  const lowerText = linkText.toLowerCase().trim();
  
  // Check if link text is vague (3 words or less and contains vague patterns)
  const words = lowerText.split(/\s+/);
  if (words.length <= 3) {
    const isVague = vaguePatterns.some(pattern => 
      lowerText === pattern || 
      lowerText.includes(pattern) ||
      words.some(word => word === pattern)
    );
    
    if (isVague) {
      return true;
    }
  }
  
  // Check for very short non-descriptive text
  if (linkText.length <= 8 && !isDescriptiveLinkText(linkText)) {
    return true;
  }
  
  return false;
}

function isDescriptiveLinkText(text) {
  // Check if text is actually descriptive (contains nouns, proper names, specific terms)
  const descriptiveWords = [
    'home', 'about', 'contact', 'products', 'services', 'blog', 'news',
    'support', 'help', 'documentation', 'guide', 'tutorial', 'pricing',
    'login', 'signup', 'register', 'profile', 'account', 'dashboard',
    'settings', 'preferences', 'cart', 'checkout', 'order', 'search'
  ];
  
  const lowerText = text.toLowerCase().trim();
  return descriptiveWords.some(word => lowerText.includes(word)) || 
         text.length > 15; // Longer text is likely more descriptive
}

function getLinkText(link) {
  // Get the visible text content of the link
  let text = link.textContent || link.innerText || '';
  
  // If no visible text, check aria-label
  if (!text.trim()) {
    text = link.getAttribute('aria-label') || '';
  }
  
  // If still no text, check title attribute
  if (!text.trim()) {
    text = link.getAttribute('title') || '';
  }
  
  return text.trim();
}

async function generateLinkText(linkElement) {
  try {
    // Capture the link and its context
    const linkImageData = await captureLinkElement(linkElement);
    const contextImageData = await captureLinkWithContext(linkElement);
    
    const pageContext = getPageContext(linkElement);
    const linkContext = getLinkContext(linkElement);
    const destinationInfo = getLinkDestination(linkElement);
    
    const prompt = `You are a web accessibility expert tasked with generating descriptive link text that clearly indicates where the link goes or what action it performs.

# You will receive:
- Link element screenshot (isolated)
- Link element with surrounding context screenshot

# Your task is to generate descriptive, actionable link text that replaces vague phrases.

# Steps:
1. Analyze the page context to understand the website's purpose and content
2. Analyze the link's surrounding context to understand its role
3. Examine the link destination to understand where it leads
4. Generate clear, descriptive link text that tells users exactly what to expect
5. Add an aria-label to provide additional context for screen reader users. 

# Guidelines:
- Replace vague text like "click here", "read more", "learn more" with specific descriptions
- Include the destination or action in the link text
- Keep text concise but descriptive (ideally 2-8 words)
- Make the purpose immediately clear to screen reader users
- Consider the context - what is this link's role on the page?

# Bad vs good examples of link text:
1. Bad: Learn more about our products <a href="/products.html"here</a>
   Good: Learn more about <a href="/products.html">our products</a>.
2. Bad: To read a fascinating article about microbes <a href="http://tinyurl.com/c3z77jt">click here</a>.
   Good: Read a fascinating article about the <a href="http://tinyurl.com/c3z77jt">resident microbes in the human body</a>

# Current link information:
${linkContext}
${destinationInfo}
`;

    const response = await fetch('http://localhost:1234/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: "gemma-3n-4b-it",
        messages: [
          {
            role: "system",
            content: "You are a web accessibility expert who generates descriptive link text."
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${prompt}\n\nPage Context: ${pageContext}`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${linkImageData}`
                }
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${contextImageData}`
                }
              }
            ]
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "link_text_enhancement",
            strict: true,
            schema: {
              type: "object",
              properties: {
                current_text_analysis: {
                  type: "string",
                  description: "Analysis of why the current link text is problematic"
                },
                link_purpose: {
                  type: "string",
                  description: "What does this link do or where does it go?"
                },
                suggested_text: {
                  type: "string",
                  description: "Improved, descriptive link text"
                },
                aria_label: {
                  type: "string",
                  description: "ARIA label for screen readers (can be same as suggested text)"
                },
                improvement_reasoning: {
                  type: "string",
                  description: "Why this new text is better for accessibility"
                }
              },
              required: ["current_text_analysis", "link_purpose", "suggested_text", "aria_label", "improvement_reasoning"]
            }
          }
        },
        max_tokens: 300,
        temperature: 0.2,
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return JSON.parse(result.choices[0].message.content);
    
  } catch (error) {
    console.error('Link text generation error:', error);
    throw error;
  }
}

// Helper functions for link enhancement
function getLinkContext(linkElement) {
  const contexts = [];
  
  // Link type and attributes
  contexts.push(`Element: ${linkElement.tagName.toLowerCase()}`);
  if (linkElement.target) contexts.push(`Target: ${linkElement.target}`);
  if (linkElement.download) contexts.push('Download link');
  
  // Position context
  const nav = linkElement.closest('nav');
  if (nav) contexts.push('In navigation');
  
  const header = linkElement.closest('header');
  if (header) contexts.push('In header');
  
  const footer = linkElement.closest('footer');
  if (footer) contexts.push('In footer');
  
  const main = linkElement.closest('main, article');
  if (main) contexts.push('In main content');
  
  // Parent element context
  const button = linkElement.closest('button');
  if (button && button !== linkElement) contexts.push('Inside button');
  
  const list = linkElement.closest('ul, ol');
  if (list) {
    const listItems = list.querySelectorAll('li');
    contexts.push(`In list of ${listItems.length} items`);
  }
  
  // Surrounding text context
  const parent = linkElement.parentElement;
  if (parent) {
    const parentText = parent.textContent.replace(linkElement.textContent || '', '').trim();
    if (parentText && parentText.length > 10) {
      contexts.push(`Context: "${parentText.slice(0, 50)}"`);
    }
  }
  
  // Previous/next link context
  const prevLink = getPreviousLink(linkElement);
  if (prevLink) {
    const prevText = getLinkText(prevLink);
    if (prevText) {
      contexts.push(`Previous link: "${prevText}"`);
    }
  }
  
  return contexts.join('. ').slice(0, 300);
}

function getLinkDestination(linkElement) {
  const destinations = [];
  
  // URL analysis
  const href = linkElement.href || linkElement.getAttribute('href');
  if (href) {
    try {
      const url = new URL(href, window.location.origin);
      
      // Domain info
      if (url.hostname !== window.location.hostname) {
        destinations.push(`External site: ${url.hostname}`);
      } else {
        destinations.push('Internal link');
      }
      
      // Path analysis
      const pathParts = url.pathname.split('/').filter(part => part);
      if (pathParts.length > 0) {
        destinations.push(`Path: /${pathParts.join('/')}`);
      }
      
      // Query parameters
      if (url.search) {
        destinations.push(`Has parameters: ${url.search.slice(0, 50)}`);
      }
      
      // Fragment/anchor
      if (url.hash) {
        destinations.push(`Anchor: ${url.hash}`);
      }
      
      // File type detection
      const fileName = pathParts[pathParts.length - 1] || '';
      const fileExt = fileName.split('.').pop();
      if (fileExt && ['pdf', 'doc', 'docx', 'zip', 'mp4', 'mp3', 'jpg', 'png'].includes(fileExt.toLowerCase())) {
        destinations.push(`File type: ${fileExt.toUpperCase()}`);
      }
      
    } catch (error) {
      destinations.push(`URL: ${href.slice(0, 100)}`);
    }
  }
  
  // onclick handler analysis
  const onclick = linkElement.getAttribute('onclick');
  if (onclick) {
    destinations.push(`JavaScript action: ${onclick.slice(0, 50)}`);
  }
  
  // data attributes that might indicate destination
  const dataHref = linkElement.getAttribute('data-href');
  if (dataHref) {
    destinations.push(`Data destination: ${dataHref}`);
  }
  
  return destinations.join('. ').slice(0, 200);
}

function getPreviousLink(linkElement) {
  const allLinks = Array.from(document.querySelectorAll('a[href], button[onclick], button[data-href]'));
  const currentIndex = allLinks.indexOf(linkElement);
  return currentIndex > 0 ? allLinks[currentIndex - 1] : null;
}

// UI helper functions for links
function addGeneratedLinkText(linkElement, newText) {
  // Store original text for reference
  const originalText = getLinkText(linkElement);
  linkElement.setAttribute('data-original-text', originalText);
  
  // Update the link text
  linkElement.textContent = newText;
  
  // Add visual indicator that this was AI-generated
  linkElement.style.cssText += `
    background: rgba(37, 99, 235, 0.1) !important;
    border-left: 3px solid #2563eb !important;
    padding-left: 6px !important;
  `;
  
  linkElement.setAttribute('data-ai-generated', 'true');
  linkElement.setAttribute('title', `AI-improved from: "${originalText}"`);
}

function displayLinkAccessibilityAnalysis(linkElement, analysis) {
  const tooltip = document.createElement('div');
  
  const currentText = getLinkText(linkElement);
  const originalText = linkElement.getAttribute('data-original-text') || currentText;
  
  // Color code based on accessibility score
  let scoreColor = '#dc3545'; // Red for poor
  if (analysis.accessibility_score >= 8) scoreColor = '#28a745'; // Green for good
  else if (analysis.accessibility_score >= 5) scoreColor = '#ffc107'; // Yellow for okay
  
  tooltip.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">🔗 Link Accessibility Analysis</div>
    
    <div style="margin-bottom: 8px;">
      <div style="font-size: 10px; color: #ccc;">CURRENT TEXT:</div>
      <div style="background: rgba(255,255,255,0.1); padding: 4px; border-radius: 3px; font-size: 10px;">
        "${currentText}"
        ${originalText !== currentText ? `<br><em style="opacity: 0.7;">Originally: "${originalText}"</em>` : ''}
      </div>
    </div>
    
    <div style="margin-bottom: 8px;">
      <span style="color: ${scoreColor}; font-weight: bold;">Score: ${analysis.accessibility_score}/10</span>
      <span style="margin-left: 10px; font-size: 10px;">
        ${analysis.is_accessible ? "✅ Accessible" : "❌ Needs work"}
      </span>
    </div>
    
    <div style="margin-bottom: 8px;">
      <div style="font-size: 10px; color: #17a2b8;">CLARITY:</div>
      <div style="font-size: 10px;">
        Text: ${analysis.text_clarity} | Purpose: ${analysis.purpose_clarity}
      </div>
    </div>
    
    ${analysis.issues_found.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #ffc107;">ISSUES:</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
          ${analysis.issues_found.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${analysis.suggestions.length > 0 ? `
      <div style="margin-bottom: 8px;">
        <div style="font-size: 10px; color: #28a745;">SUGGESTIONS:</div>
        <ul style="margin: 4px 0; padding-left: 16px; font-size: 10px;">
          ${analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    <div style="font-size: 9px; opacity: 0.8; margin-top: 8px;">
      ${analysis.reasoning}
    </div>
  `;
  
  tooltip.style.cssText = `
    position: absolute;
    background: #059669;
    color: white;
    padding: 12px;
    border-radius: 6px;
    font-size: 11px;
    z-index: 10001;
    max-width: 350px;
    line-height: 1.4;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    border: 1px solid #10b981;
  `;
  
  const rect = linkElement.getBoundingClientRect();
  tooltip.style.left = (rect.right + window.scrollX + 10) + 'px';
  tooltip.style.top = (rect.top + window.scrollY) + 'px';
  
  // Adjust position if tooltip would go off screen
  if (rect.right + 370 > window.innerWidth) {
    tooltip.style.left = (rect.left + window.scrollX - 360) + 'px';
  }
  
  document.body.appendChild(tooltip);
  
  // Remove tooltip after 12 seconds
  setTimeout(() => {
    if (tooltip.parentNode) {
      tooltip.remove();
    }
  }, 12000);
  
  console.log('Link accessibility analysis:', {
    current_text: currentText,
    score: analysis.accessibility_score,
    is_accessible: analysis.is_accessible,
    text_clarity: analysis.text_clarity,
    purpose_clarity: analysis.purpose_clarity,
    issues: analysis.issues_found,
    suggestions: analysis.suggestions
  });
}

async function captureLinkElement(linkElement) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const rect = linkElement.getBoundingClientRect();
      const padding = 10;
      
      canvas.width = Math.max(200, rect.width + padding * 2);
      canvas.height = Math.max(40, rect.height + padding * 2);
      
      // Fill background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw link border/background
      const computedStyle = window.getComputedStyle(linkElement);
      ctx.fillStyle = computedStyle.backgroundColor || '#f8fafc';
      ctx.fillRect(padding, padding, rect.width, rect.height);
      
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1;
      ctx.strokeRect(padding, padding, rect.width, rect.height);
      
      // Add link indicator
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('LINK', padding + 5, padding + 15);
      
      // Add link text
      const linkText = getLinkText(linkElement);
      if (linkText) {
        ctx.fillStyle = '#1d4ed8';
        ctx.font = '12px Arial';
        ctx.fillText(linkText.substring(0, 25), padding + 5, padding + rect.height - 8);
      }
      
      // Add destination hint
      const href = linkElement.href || linkElement.getAttribute('onclick') || '';
      if (href) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '10px Arial';
        let destination = href;
        if (href.startsWith('http')) {
          try {
            destination = new URL(href).pathname.split('/').pop() || new URL(href).hostname;
          } catch (e) {
            destination = href.slice(0, 20);
          }
        }
        ctx.fillText(`→ ${destination.substring(0, 20)}`, padding + 5, padding + rect.height / 2 + 5);
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      
    } catch (error) {
      console.error('Link capture error:', error);
      // Fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 300;
      canvas.height = 50;
      
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 300, 50);
      ctx.strokeStyle = '#2563eb';
      ctx.strokeRect(5, 5, 290, 40);
      ctx.fillStyle = '#2563eb';
      ctx.font = '14px Arial';
      ctx.fillText('Link Element', 10, 28);
      
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    }
  });
}

async function captureLinkWithContext(linkElement) {
  return new Promise((resolve, reject) => {
    try {
      const rect = linkElement.getBoundingClientRect();
      const padding = 150;
      
      const contextRect = {
        x: Math.max(0, rect.left - padding),
        y: Math.max(0, rect.top - padding),
        width: Math.min(window.innerWidth, rect.width + padding * 2),
        height: Math.min(window.innerHeight, rect.height + padding * 2)
      };
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = Math.min(800, contextRect.width);
      canvas.height = Math.min(600, contextRect.height);
      
      // Fill background
      ctx.fillStyle = window.getComputedStyle(document.body).backgroundColor || '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const linkRelativeX = rect.left - contextRect.x;
      const linkRelativeY = rect.top - contextRect.y;
      
      // Add context text elements
      addLinkContextText();
      
      // Highlight the target link
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;
      ctx.strokeRect(linkRelativeX - 2, linkRelativeY - 2, rect.width + 4, rect.height + 4);
      
      function addLinkContextText() {
        ctx.fillStyle = '#000000';
        ctx.font = '14px Arial';
        
        // Get nearby elements and their positions
        const nearbyElements = document.querySelectorAll('a, button, h1, h2, h3, h4, h5, h6, p, span, div');
        
        nearbyElements.forEach((el) => {
          const elRect = el.getBoundingClientRect();
          const elX = elRect.left - contextRect.x;
          const elY = elRect.top - contextRect.y + 15;
          
          if (elX >= 0 && elX < canvas.width && elY >= 0 && elY < canvas.height && el !== linkElement) {
            let text = '';
            
            if (el.tagName === 'A') {
              text = `LINK: ${el.textContent.trim().slice(0, 20)}`;
            } else if (el.tagName === 'BUTTON') {
              text = `BTN: ${el.textContent.trim().slice(0, 20)}`;
            } else if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(el.tagName)) {
              text = `${el.tagName}: ${el.textContent.trim().slice(0, 25)}`;
            } else if (['P', 'SPAN', 'DIV'].includes(el.tagName) && el.textContent.trim()) {
              text = el.textContent.trim().slice(0, 30);
            }
            
            if (text) {
              ctx.fillStyle = '#6b7280';
              ctx.font = '12px Arial';
              ctx.fillText(text, elX, elY);
            }
          }
        });
      }
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
      
    } catch (error) {
      console.error('Link context capture error:', error);
      // Fallback
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 400;
      canvas.height = 300;
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 400, 300);
      ctx.fillStyle = '#e5f3ff';
      ctx.fillRect(150, 120, 100, 30);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.strokeRect(148, 118, 104, 34);
      ctx.fillStyle = '#374151';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Link Context', 200, 200);
      
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    }
  });
}

function removeLinkHighlights() {
  // Remove link highlights
  const highlightedLinks = document.querySelectorAll('.ai-link-highlight, .ai-link-analysis');
  highlightedLinks.forEach(link => {
    link.style.outline = "";
    link.classList.remove('ai-link-highlight', 'ai-link-analysis');
    
    // Remove AI-generated styling
    if (link.getAttribute('data-ai-generated')) {
      link.style.background = "";
      link.style.borderLeft = "";
      link.style.paddingLeft = "";
    }
  });
  
  // Remove AI-generated attributes and restore original text
  const aiLinks = document.querySelectorAll('[data-ai-generated="true"]');
  aiLinks.forEach(link => {
    const originalText = link.getAttribute('data-original-text');
    if (originalText) {
      link.textContent = originalText;
    }
    link.removeAttribute('data-ai-generated');
    link.removeAttribute('data-original-text');
    link.removeAttribute('title');
  });
  
  // Remove link tooltips
  const linkTooltips = document.querySelectorAll('[style*="background: #059669"]');
  linkTooltips.forEach(tooltip => tooltip.remove());
}
