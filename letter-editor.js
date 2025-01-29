document.addEventListener("alpine:init", () => {
  Alpine.data("letterEditor", () => ({
    // State
    letters: null,
    officials: null,
    currentLetter: null,
    letterContent: null,
    originalLetterContent: null,
    selectedRecipients: [],
    isLoading: false,
    error: null,
    isDirty: false,
    formErrors: {
      signature: false,
      email: false,
      recipients: false,
    },
    converter: new showdown.Converter({
      tables: true,
      simplifiedAutoLink: true,
      strikethrough: true,
      tasklists: true,
    }),
    userData: Alpine.$persist({
      signature: "",
      email: "",
      address: "",
    }).as("user_data"),
    // Debounce timeouts
    _saveTimeout: null,
    _validateTimeout: null,
    _submitTimeout: null,

    // Initialize
    async init() {
      this.isLoading = true;
      try {
        const response = await fetch("letters-config.json");
        if (!response.ok) throw new Error("Failed to load config");
        const config = await response.json();
        this.letters = config.letters;
        this.officials = config.officials;

        // Check URL for letter ID
        const letterId = window.location.hash.slice(1);
        if (letterId && this.letters[letterId]) {
          await this.showLetter(letterId);
        }

        // Watch for changes
        this.$watch("userData", () => {
          this.isDirty = true;
          this.debouncedValidate();
        });
        this.$watch("selectedRecipients", () => {
          this.debouncedValidate();
        });
      } catch (error) {
        console.error("Failed to initialize app:", error);
        this.error = "Failed to load letters. Please try refreshing the page.";
      } finally {
        this.isLoading = false;
      }
    },

    // Letter list methods
    isExpired(letter) {
      return new Date(letter.expires_at) < new Date();
    },

    formatDate(date) {
      return new Date(date).toLocaleDateString();
    },

    getTagClasses(tag) {
      const local_tag = tag.toLowerCase();
      const colors = {
        urgent: { color: "red", light: "100", dark: "800" },
        safety: { color: "orange", light: "100", dark: "800" },
        "public-health": { color: "light-green", light: "100", dark: "800" },
        "jefferson square park": { color: "green", light: "100", dark: "800" },
      };

      const colorPairs = [
        { color: "stone", light: "100", dark: "700" },
        { color: "red", light: "50", dark: "700" },
        { color: "orange", light: "50", dark: "700" },
        { color: "amber", light: "50", dark: "700" },
        { color: "yellow", light: "50", dark: "700" },
        { color: "lime", light: "50", dark: "700" },
        { color: "green", light: "50", dark: "700" },
        { color: "emerald", light: "50", dark: "700" },
        { color: "teal", light: "50", dark: "700" },
        { color: "cyan", light: "50", dark: "700" },
        { color: "sky", light: "50", dark: "700" },
        { color: "blue", light: "50", dark: "700" },
        { color: "indigo", light: "50", dark: "700" },
        { color: "violet", light: "50", dark: "700" },
        { color: "purple", light: "50", dark: "700" },
        { color: "fuchsia", light: "50", dark: "700" },
        { color: "pink", light: "50", dark: "700" },
        { color: "rose", light: "50", dark: "700" },
      ];

      let colorConfig;
      if (colors[local_tag]) {
        colorConfig = colors[local_tag];
      } else {
        // Generate a consistent color from the tag name
        const hash = local_tag
          .split("")
          .reduce(
            (accumulator, char) =>
              (accumulator << 5) - accumulator + char.charCodeAt(0),
            0
          );

        const colorIndex = Math.abs(hash) % colorPairs.length;
        colorConfig = colorPairs[colorIndex];
      }
      const { color, light, dark } = colorConfig;
      return `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${color}-${light} text-${color}-${dark}`;
    },

    // Letter editor methods
    async showLetter(letterId) {
      this.isLoading = true;
      this.error = null;
      try {
        const letter = this.letters[letterId];
        if (!letter) throw new Error("Letter not found");

        const response = await fetch(`letters/${letterId}.md`);
        if (!response.ok) throw new Error("Failed to load letter content");

        this.originalLetterContent = await response.text();
        this.letterContent =
          this.loadSavedContent() || this.originalLetterContent;
        this.currentLetter = letter;
        this.selectedRecipients = [...letter.default_recipients];
        if (window.location.hash !== `#${letterId}`) {
          history.pushState(null, "", `#${letterId}`);
        }
      } catch (error) {
        console.error("Failed to load letter:", error);
        this.error = "Failed to load letter content. Please try again.";
        this.showLetterList();
      } finally {
        this.isLoading = false;
      }
    },

    showLetterList() {
      this.currentLetter = null;
      this.letterContent = null;
      this.originalLetterContent = null;
      this.selectedRecipients = [];
      if (window.location.hash) {
        history.pushState(null, "", window.location.pathname);
      }
    },

    // Recipient selection methods
    getSelectedCount(group) {
      return Object.keys(group.members).filter((id) =>
        this.selectedRecipients.includes(id)
      ).length;
    },

    // User data methods
    loadUserData() {
      this.userData = {
        signature: localStorage.getItem("user_signature") || "",
        email: localStorage.getItem("user_email") || "",
        address: localStorage.getItem("user_address") || "",
      };
    },

    saveUserData() {
      for (const [key, value] of Object.entries(this.userData)) {
        if (value) {
          localStorage.setItem(`user_${key}`, value);
        } else {
          localStorage.removeItem(`user_${key}`);
        }
      }
    },

    // Letter content methods
    get hasChanges() {
      return this.letterContent?.trim() !== this.originalLetterContent?.trim();
    },

    resetLetter() {
      if (
        !confirm("Reset letter to original content? Your changes will be lost.")
      )
        return;
      this.letterContent = this.originalLetterContent;
      localStorage.removeItem(this.getLetterKey());
    },

    getLetterKey() {
      return `letter_content_${
        this.currentLetter?.id || window.location.hash.slice(1)
      }`;
    },

    loadSavedContent() {
      return localStorage.getItem(this.getLetterKey());
    },

    saveLetter() {
      if (this._saveTimeout) clearTimeout(this._saveTimeout);
      this._saveTimeout = setTimeout(() => {
        this.$nextTick(() => {
          localStorage.setItem(this.getLetterKey(), this.letterContent);
        });
      }, 500);
    },

    formatEmailContent() {
      return `Dear ${this.formatRecipientList()}:

${this.letterContent}

Sincerely,

${this.userData.signature}
${this.userData.email ? `\n${this.userData.email}` : ""}
${
  this.userData.address
    ? `\nResident of ${this.formatAddress(this.userData.address)}`
    : ""
}

This letter is copied to:
${this.selectedRecipients
  .map((id) => `- ${this.getOfficial(id).name} (${this.getOfficialEmail(id)})`)
  .join("\n")}
${this.getCCEmails()}`;
    },

    // Letter preview/editing methods
    renderLetterContent() {
      if (!this.currentLetter) return "";

      const headerHtml = this.renderMarkdown(`# ${this.currentLetter.title}
${new Date().toLocaleDateString()}

Dear ${this.formatRecipientList()}:`);

      const editableSection = `
        <div class="editable-section" 
             @click="$refs.textarea.focus()" 
             data-edit-message="${
               this.hasChanges ? "Click to continue editing" : "Click to edit"
             }">
          <div class="content" x-html="renderMarkdown(letterContent)"></div>
          <textarea x-ref="textarea"
                   x-model="letterContent"
                   @input="saveLetter()"
                   placeholder="Write your letter here..."></textarea>
        </div>
      `;

      const footerHtml = this.renderMarkdown(`Sincerely,

${this.userData.signature || "[Your Name]"}

${
  this.userData.address
    ? `Resident of ${this.formatAddress(this.userData.address)}`
    : ""
}

This letter is sent to:
${this.selectedRecipients
  .map((id) => `- ${this.getOfficial(id).name} (${this.getOfficialEmail(id)})`)
  .join("\n")}
${this.getCCEmails()}`);

      return `${headerHtml}${editableSection}${footerHtml}`;
    },

    renderMarkdown(content) {
      return this.converter.makeHtml(content || "");
    },

    formatRecipientList() {
      const officals_groups = Object.values(this.officials);
      const names = this.selectedRecipients
        .flatMap((id) => officals_groups.map((grp) => grp.members[id]))
        .filter(Boolean)
        .map(
          (official) =>
            `${official.title ? `${official.title} ` : ""}${official.name}`
        );
      console.log(names);

      switch (names.length) {
        case 0:
          return "[Recipients]";
        case 1:
          return names[0];
        case 2:
          return `${names[0]} and ${names[1]}`;
        default:
          return `${names.slice(0, -1).join(", ")}, and ${names.slice(-1)}`;
      }
    },

    formatAddress(address) {
      if (!address) return "";
      return address
        .split(",")
        .map((line) => line.trim())
        .join(",");
    },

    getCCEmails() {
      const ccEmails = new Set();
      for (const id of this.selectedRecipients) {
        const official = this.getOfficial(id);
        if (official?.cc) {
          for (const email of official.cc) {
            ccEmails.add(email);
          }
        }
      }
      return ccEmails.size
        ? `\nCC:\n${Array.from(ccEmails)
            .map((email) => `- ${email}`)
            .join("\n")}`
        : "";
    },

    getOfficial(id) {
      for (const group of Object.values(this.officials)) {
        if (id in group.members) {
          return group.members[id];
        }
      }
      return null;
    },

    getOfficialEmail(id) {
      return this.getOfficial(id)?.email || "";
    },

    // Form validation and submission
    validateForm() {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      this.formErrors = {
        signature: {
          error: !this.userData.signature?.trim(),
          message: "Please enter your name",
        },
        email: {
          error: !emailRegex.test(this.userData.email),
          message: this.userData.email
            ? "Please enter a valid email address"
            : "Please enter your email address",
        },
        recipients: {
          error: this.selectedRecipients.length === 0,
          message: "Please select at least one recipient",
        },
      };
      return !Object.values(this.formErrors).some((f) => f.error);
    },

    // Debounced methods
    debouncedValidate() {
      if (this._validateTimeout) clearTimeout(this._validateTimeout);
      this._validateTimeout = setTimeout(() => {
        this.$nextTick(() => {
          this.validateForm();
        });
      }, 300);
    },

    async sendLetter(event) {
      event.preventDefault();

      // Debounce submissions
      if (this._submitTimeout) return;
      this._submitTimeout = setTimeout(() => {
        this._submitTimeout = null;
      }, 1000);

      if (!this.validateForm()) {
        alert(
          "Please fill in all required fields and select at least one recipient."
        );
        return;
      }

      // Save user data for future use
      this.saveUserData();

      // Build email content
      const subject = encodeURIComponent(this.currentLetter.title);
      const body = encodeURIComponent(this.formatEmailContent());

      // Get recipient emails
      const to = this.selectedRecipients
        .map((id) => this.getOfficialEmail(id))
        .filter(Boolean)
        .join(",");

      // Get CC emails
      const ccEmails = new Set();
      for (const id of this.selectedRecipients) {
        const official = this.getOfficial(id);
        if (official?.cc) {
          for (const email of official.cc) {
            ccEmails.add(email);
          }
        }
      }
      const cc = Array.from(ccEmails).join(",");

      // Open email client
      window.location.href = `mailto:${to}?${
        cc ? `cc=${cc}&` : ""
      }subject=${subject}&body=${body}`;
    },

    // Handle route changes
    handleRoute() {
      const letterId = window.location.hash.slice(1);
      if (letterId && this.letters?.[letterId]) {
        this.showLetter(letterId);
      } else {
        this.showLetterList();
      }
    },
  }));
});
