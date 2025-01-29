// Global state
let config = null;
let currentLetter = null;
let letterContent = null;
let originalLetterContent = null;

// Initialize Showdown converter
const converter = new showdown.Converter({
  tables: true,
  simplifiedAutoLink: true,
  strikethrough: true,
  tasklists: true,
});

// Helper function to clean template strings
function cleanDoc(str) {
  // Remove initial newline and find minimum indentation
  const lines = str.replace(/^\n/, "").split("\n");
  const minIndent = lines
    .filter((line) => line.trim())
    .reduce(
      (min, line) => Math.min(min, line.match(/^\s*/)[0].length),
      Infinity
    );

  // Remove the minimum indentation from each line and join back
  return lines
    .map((line) => line.slice(minIndent))
    .join("\n")
    .trim();
}

// Create checkboxes for recipients
function createRecipientCheckboxes() {
  const container = document.getElementById("recipientCheckboxes");
  container.innerHTML = "";
  container.className = "flex flex-wrap gap-x-8 gap-y-6";

  for (const [groupId, group] of Object.entries(config.officials)) {
    const categoryDiv = document.createElement("div");
    categoryDiv.className = "min-w-[250px]";

    // Count selected recipients in this category
    const selectedCount = Object.keys(group.members).filter((id) =>
      currentLetter.default_recipients.includes(id)
    ).length;

    categoryDiv.innerHTML = `
            <details>
                <summary class="font-medium text-gray-900 mb-2 cursor-pointer hover:text-blue-600">
                    ${group.title}
                    <span class="text-sm text-gray-500">(${selectedCount} selected)</span>
                </summary>
                <div class="space-y-2 ml-4">
                </div>
            </details>
        `;

    const membersContainer = categoryDiv.querySelector("div");
    for (const [id, official] of Object.entries(group.members)) {
      const div = document.createElement("div");
      div.className = "flex items-start";
      div.innerHTML = `
                <input type="checkbox" 
                    id="recipient-${id}" 
                    value="${id}"
                    ${
                      currentLetter.default_recipients.includes(id)
                        ? "checked"
                        : ""
                    }
                    class="h-4 w-4 mt-1 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    onchange="updateLetter(); updateSelectedCount(this)">
                <label for="recipient-${id}" 
                    class="ml-2 block">
                    <div class="text-sm text-gray-900">
                        ${official.name}
                        ${
                          official.title
                            ? `<span class="text-xs text-gray-500 ml-1">(${official.title})</span>`
                            : ""
                        }
                    </div>
                    <div class="text-xs text-gray-500">${official.email}</div>
                </label>`;
      membersContainer.appendChild(div);
    }

    container.appendChild(categoryDiv);
  }
}

// Update the selected count in a category
function updateSelectedCount(checkbox) {
  const categoryDetails = checkbox.closest("details");
  const summary = categoryDetails.querySelector("summary");
  const checkboxes = categoryDetails.querySelectorAll('input[type="checkbox"]');
  const selectedCount = Array.from(checkboxes).filter(
    (cb) => cb.checked
  ).length;

  const countSpan = summary.querySelector("span");
  countSpan.textContent = `(${selectedCount} selected)`;
}

// Get selected recipient IDs
function getSelectedRecipients() {
  const checkboxes = document.querySelectorAll(
    '#recipientCheckboxes input[type="checkbox"]'
  );
  return Array.from(checkboxes)
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
}

// Get official's name by ID
function getOfficialName(id) {
  for (const group of Object.values(config.officials)) {
    if (id in group.members) {
      return group.members[id].name;
    }
  }
  return null;
}

// Get official's email by ID
function getOfficialEmail(id) {
  for (const group of Object.values(config.officials)) {
    if (id in group.members) {
      return group.members[id].email;
    }
  }
  return null;
}

// Get CC emails for selected recipients
function getCCEmails(recipientIds) {
  const ccEmails = new Set();
  for (const id of recipientIds) {
    for (const group of Object.values(config.officials)) {
      if (id in group.members && group.members[id].cc) {
        for (const email of group.members[id].cc) {
          ccEmails.add(email);
        }
      }
    }
  }
  return Array.from(ccEmails);
}

// Format address lines
function formatAddress(address) {
  if (!address) return "";
  return address
    .split(",")
    .map((line) => line.trim())
    .join("\n");
}

// Title case function for names
function toTitleCase(str) {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => {
      if (word.includes("-")) {
        return word
          .split("-")
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join("-");
      }
      if (word.startsWith("mc") && word.length > 2) {
        return `Mc${word.charAt(2).toUpperCase()}${word.slice(3)}`;
      }
      if (word.startsWith("mac") && word.length > 3) {
        return `Mac${word.charAt(3).toUpperCase()}${word.slice(4)}`;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// Save user data to localStorage
function saveUserData() {
  const signature =
    document.getElementById("global_signature")?.value.trim() ||
    document.getElementById("signature")?.value.trim();
  const email =
    document.getElementById("global_email")?.value.trim() ||
    document.getElementById("email")?.value.trim();
  const address =
    document.getElementById("global_address")?.value.trim() ||
    document.getElementById("address")?.value.trim();

  if (signature) localStorage.setItem("user_signature", signature);
  if (email) localStorage.setItem("user_email", email);
  if (address) localStorage.setItem("user_address", address);
}

// Load user data from localStorage
function loadUserData() {
  const signature = localStorage.getItem("user_signature");
  const email = localStorage.getItem("user_email");
  const address = localStorage.getItem("user_address");

  // Update global inputs
  if (signature) {
    const globalSignature = document.getElementById("global_signature");
    if (globalSignature) globalSignature.value = signature;
  }
  if (email) {
    const globalEmail = document.getElementById("global_email");
    if (globalEmail) globalEmail.value = email;
  }
  if (address) {
    const globalAddress = document.getElementById("global_address");
    if (globalAddress) globalAddress.value = address;
  }

  // Update letter inputs if they exist
  const letterSignature = document.getElementById("signature");
  const letterEmail = document.getElementById("email");
  const letterAddress = document.getElementById("address");

  if (letterSignature && signature) letterSignature.value = signature;
  if (letterEmail && email) letterEmail.value = email;
  if (letterAddress && address) letterAddress.value = address;

  if (currentLetter && (signature || email || address)) {
    updateLetter();
  }
}

// First, let's fix the event listeners by wrapping them in a function
function initializeEventListeners() {
  document.getElementById("signature")?.addEventListener("input", (e) => {
    const cursorPosition = e.target.selectionStart;
    const untitledValue = e.target.value;
    const titledValue = toTitleCase(untitledValue);

    if (untitledValue !== titledValue) {
      e.target.value = titledValue;
      e.target.setSelectionRange(cursorPosition, cursorPosition);
    }

    updateLetter();
    saveUserData();
  });

  document.getElementById("email")?.addEventListener("input", () => {
    updateLetter();
    saveUserData();
  });

  document.getElementById("address")?.addEventListener("input", () => {
    updateLetter();
    saveUserData();
  });

  // Add global input listeners
  document
    .getElementById("global_signature")
    ?.addEventListener("input", (e) => {
      const cursorPosition = e.target.selectionStart;
      const untitledValue = e.target.value;
      const titledValue = toTitleCase(untitledValue);

      if (untitledValue !== titledValue) {
        e.target.value = titledValue;
        e.target.setSelectionRange(cursorPosition, cursorPosition);
      }

      saveUserData();
    });

  document.getElementById("global_email")?.addEventListener("input", () => {
    saveUserData();
  });

  document.getElementById("global_address")?.addEventListener("input", () => {
    saveUserData();
  });
}

// Then modify the updateLetter function that's missing
function updateLetter() {
  if (!currentLetter) return;

  const recipientIds = getSelectedRecipients();
  const recipientNames = recipientIds.map((id) => getOfficialName(id));
  const signature = document.getElementById("signature").value || "[Your Name]";
  const email = document.getElementById("email").value || "[Your Email]";
  const address = document.getElementById("address").value;

  // Update the preview content
  document.getElementById("letterPreview").innerHTML = converter.makeHtml(
    document.getElementById("letterBody").value
  );

  // Update header
  const headerHtml = converter.makeHtml(`# ${currentLetter.title}
Dear ${
    recipientNames.length > 1
      ? `${recipientNames.slice(0, -1).join(", ")} and ${recipientNames.slice(
          -1
        )}`
      : recipientNames[0] || "[Recipients]"
  }:`);

  // Update footer
  const footerHtml = converter.makeHtml(`Sincerely,

${signature}

${email}

${formatAddress(address)}

Sent To:
${recipientIds.map((id) => `- ${getOfficialEmail(id)}`).join("\n")}
${
  getCCEmails(recipientIds).length
    ? `\nCC:\n${getCCEmails(recipientIds)
        .map((email) => `- ${email}`)
        .join("\n")}`
    : ""
}`);

  // Replace header and footer while preserving the editable section
  const container = document.getElementById("letterContainer");
  const editableSection = container.querySelector(".editable-section");

  // Replace everything before the editable section (header)
  while (container.firstChild !== editableSection) {
    container.removeChild(container.firstChild);
  }
  container.insertAdjacentHTML("afterbegin", headerHtml);

  // Replace everything after the editable section (footer)
  while (container.lastChild !== editableSection) {
    container.removeChild(container.lastChild);
  }
  container.insertAdjacentHTML("beforeend", footerHtml);
}

// Validate email format
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Validate form inputs
function validateForm() {
  const signature = document.getElementById("signature").value.trim();
  const email = document.getElementById("email").value.trim();
  const emailError = document.getElementById("emailError");

  let isValid = true;

  if (!signature) {
    document.getElementById("signature").classList.add("invalid");
    isValid = false;
  } else {
    document.getElementById("signature").classList.remove("invalid");
  }

  if (!email) {
    emailError.textContent = "Email is required";
    emailError.style.display = "block";
    isValid = false;
  } else if (!validateEmail(email)) {
    emailError.textContent = "Please enter a valid email address";
    emailError.style.display = "block";
    isValid = false;
  } else {
    emailError.style.display = "none";
  }

  return isValid;
}

// Send the letter
function sendLetter(event) {
  // Prevent default if this was triggered by a click event
  if (event) {
    event.preventDefault();
  }

  if (!validateForm()) {
    alert("Please fill in all required fields correctly before sending.");
    return;
  }

  const recipientIds = getSelectedRecipients();
  if (recipientIds.length === 0) {
    alert("Please select at least one recipient.");
    return;
  }

  const recipientNames = recipientIds.map((id) => getOfficialName(id));
  const recipientEmails = recipientIds
    .map((id) => getOfficialEmail(id))
    .filter(Boolean)
    .join(",");
  const ccEmails = getCCEmails(recipientIds).join(",");

  const signature = document.getElementById("signature").value;
  const email = document.getElementById("email").value;
  const address = document.getElementById("address").value;

  // Format the letter with header and footer
  const letter = `Dear ${
    recipientNames.length > 1
      ? `${recipientNames.slice(0, -1).join(", ")} and ${recipientNames.slice(
          -1
        )}`
      : recipientNames[0]
  }:

${letterContent}

Sincerely,

${signature}

${email}

${formatAddress(address)}

Sent To:
${recipientIds.map((id) => `- ${getOfficialEmail(id)}`).join("\n")}
${
  ccEmails
    ? `\nCC:\n${getCCEmails(recipientIds)
        .map((email) => `- ${email}`)
        .join("\n")}`
    : ""
}`;

  const mailtoLink = `mailto:${recipientEmails}${
    ccEmails ? `?cc=${ccEmails}` : ""
  }${ccEmails ? "&" : "?"}subject=${encodeURIComponent(
    currentLetter.title
  )}&body=${encodeURIComponent(letter)}`;

  // Use window.open instead of location.href to have more control
  window.open(mailtoLink, "_blank");
  return false; // Prevent any default action
}

// Render the letter container
function renderLetterContainer() {
  const container = document.getElementById("letterContainer");
  const recipientIds = getSelectedRecipients();
  const recipientNames = recipientIds.map((id) => getOfficialName(id));

  // Format the header
  const headerHtml = converter.makeHtml(`# ${currentLetter.title}
${new Date().toLocaleDateString()}

Dear ${
    recipientNames.length > 1
      ? `${recipientNames.slice(0, -1).join(", ")} and ${recipientNames.slice(
          -1
        )}`
      : recipientNames[0] || "[Recipients]"
  }:`);

  // Format the footer with placeholders
  const footerHtml = converter.makeHtml(`Sincerely,

[Your Name]

[Your Email]

[Your Address]

Sent To:
${recipientIds.map((id) => `- ${getOfficialEmail(id)}`).join("\n")}
${
  getCCEmails(recipientIds).length
    ? `\nCC:\n${getCCEmails(recipientIds)
        .map((email) => `- ${email}`)
        .join("\n")}`
    : ""
}`);

  container.innerHTML = `
    ${headerHtml}
    <div class="editable-section" data-edit-message="Click to edit">
        <div class="content" id="letterPreview"></div>
        <textarea id="letterBody" 
            oninput="updateLetterPreview()"
            placeholder="Write your letter here..."></textarea>
    </div>
    ${footerHtml}
  `;

  document.getElementById("letterBody").value = letterContent;
  updateLetterPreview();

  // Check if there are saved changes by comparing with original
  const content = document.getElementById("letterBody").value;
  if (content.trim() !== originalLetterContent.trim()) {
    document
      .querySelector(".editable-section")
      .setAttribute("data-edit-message", "Click to continue editing");
  }
}

// Update just the letter preview
function updateLetterPreview() {
  const content = document.getElementById("letterBody").value;
  document.getElementById("letterPreview").innerHTML =
    converter.makeHtml(content);
  saveLetterContent();

  // Update edit message based on whether content has changed from original
  const editableSection = document.querySelector(".editable-section");
  const normalizedContent = content.trim().replace(/\r\n/g, "\n");
  const normalizedOriginal = originalLetterContent
    .trim()
    .replace(/\r\n/g, "\n");

  if (normalizedContent !== normalizedOriginal) {
    editableSection.setAttribute(
      "data-edit-message",
      "Click to continue editing"
    );
  } else {
    editableSection.setAttribute("data-edit-message", "Click to edit");
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("letters-config.json");
    if (!response.ok) throw new Error("Failed to load config");

    // Replace entire config state
    config = await response.json();

    // Clear and reinitialize all UI elements
    document.getElementById("letterCards").innerHTML = "";
    document.getElementById("recipientCheckboxes").innerHTML = "";
    document.getElementById("letterContainer").innerHTML = "";

    // Reset state
    currentLetter = null;
    letterContent = null;

    initializeEventListeners();
    renderLetterList();

    // Check for letter ID in URL fragment
    const letterId = window.location.hash.slice(1);
    if (letterId && config.letters[letterId]) {
      await showLetter(letterId);
    }
  } catch (error) {
    console.error("Failed to initialize app:", error);
    document.getElementById("letterCards").innerHTML = `
      <div class="p-4 text-red-600 border border-red-200 rounded-lg">
        Error loading letters. Please try refreshing the page.
      </div>
    `;
  }
});

// Also add a popstate listener to handle browser back/forward
window.addEventListener("popstate", async (event) => {
  const letterId = window.location.hash.slice(1);
  if (letterId && config.letters[letterId]) {
    await showLetter(letterId);
  } else {
    showLetterList();
  }
});

// Add these functions at the top of letter-editor.js
function renderLetterList() {
  const container = document.getElementById("letterCards");
  container.innerHTML = "";

  for (const [key, letter] of Object.entries(config.letters)) {
    const isExpired = new Date(letter.expires_at) < new Date();
    if (!isExpired) {
      container.innerHTML += `
                <a href="#${key}" 
                    onclick="showLetter('${key}')"
                    class="block p-4 border border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-medium text-gray-900">${
                              letter.title
                            }</h3>
                            <p class="text-gray-600 mt-1">${
                              letter.description
                            }</p>
                        </div>
                        <span class="text-sm text-gray-500">${new Date(
                          letter.date
                        ).toLocaleDateString()}</span>
                    </div>
                    <div class="mt-4 flex gap-2">
                        ${letter.tags
                          .map(
                            (tag) => `
                            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                                ${getTagColor(tag)}">
                                ${tag}
                            </span>
                        `
                          )
                          .join("")}
                    </div>
                </a>
            `;
    }
  }
}

function getTagColor(tag) {
  const colors = {
    urgent: "bg-red-100 text-red-800",
    safety: "bg-blue-100 text-blue-800",
    "public-health": "bg-green-100 text-green-800",
  };
  return colors[tag] || "bg-gray-100 text-gray-800";
}

// Add these functions near the top with other state management
function getLetterKey() {
  return `letter_content_${currentLetter ? window.location.hash.slice(1) : ""}`;
}

function saveLetterContent() {
  if (!currentLetter) return;
  const content = document.getElementById("letterBody").value;
  localStorage.setItem(getLetterKey(), content);
}

function loadLetterContent() {
  if (!currentLetter) return null;
  const savedContent = localStorage.getItem(getLetterKey());
  // Return saved content if it exists and differs from original
  if (savedContent && savedContent.trim() !== originalLetterContent.trim()) {
    return savedContent;
  }
  return letterContent;
}

function resetLetter() {
  if (!currentLetter) return;
  if (!confirm("Reset letter to original content? Your changes will be lost."))
    return;

  localStorage.removeItem(getLetterKey());
  letterContent = originalLetterContent;
  document.getElementById("letterBody").value = letterContent;
  document
    .querySelector(".editable-section")
    .setAttribute("data-edit-message", "Click to edit");
  updateLetterPreview();
}

// Modify the showLetter function to load saved content
async function showLetter(letterId) {
  // Clear existing state
  letterContent = null;
  originalLetterContent = null;
  currentLetter = null;
  document.getElementById("recipientCheckboxes").innerHTML = "";
  document.getElementById("letterContainer").innerHTML = "";

  // Set new state
  currentLetter = config.letters[letterId];
  const response = await fetch(`letters/${letterId}.md`);
  originalLetterContent = await response.text();
  letterContent = originalLetterContent;

  // Load saved content if it exists
  const savedContent = loadLetterContent();
  if (savedContent) {
    letterContent = savedContent;
  }

  // Switch views
  document.getElementById("letterList").classList.add("hidden");
  document.getElementById("letterEditor").classList.remove("hidden");

  // Create checkboxes and render letter
  createRecipientCheckboxes();
  renderLetterContainer();
  loadUserData();
}

function showLetterList() {
  // Clear state
  currentLetter = null;
  letterContent = null;
  document.getElementById("recipientCheckboxes").innerHTML = "";
  document.getElementById("letterContainer").innerHTML = "";

  // Switch views
  document.getElementById("letterEditor").classList.add("hidden");
  document.getElementById("letterList").classList.remove("hidden");

  // Clear URL fragment without triggering popstate
  history.pushState(
    "",
    document.title,
    window.location.pathname + window.location.search
  );

  // Re-render letter list
  renderLetterList();
}
