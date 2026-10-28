// Phase 2 login and registration behavior for MNSU CampusEco.
// This prototype stores account data in localStorage. A real backend will replace
// this browser-only storage in Phase 3.

$(document).ready(function () {
    const ACCOUNT_KEY = "campusEcoAccounts";

    const rolePages = {
        // The current repository has a space in the Operator filename.
        // Change this to "operator.html" after that file is renamed.
        operator: "operator%20.html",
        driver: "driver.html",
        recipient: "recipient.html"
    };

    function getAccounts() {
        const savedAccounts = localStorage.getItem(ACCOUNT_KEY);
        return savedAccounts ? JSON.parse(savedAccounts) : [];
    }

    function saveAccounts(accounts) {
        localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
    }

    function showMessage(elementId, message, type) {
        $(elementId)
            .removeClass("success error")
            .addClass(type)
            .text(message);
    }

    function emailLooksLikeMnsu(email) {
        return /^[^\s@]+@mnsu\.edu$/i.test(email);
    }

    // Show or hide passwords using jQuery.
    $(".password-toggle").on("click", function () {
        const targetId = $(this).data("target");
        const passwordInput = $("#" + targetId);
        const isHidden = passwordInput.attr("type") === "password";

        passwordInput.attr("type", isHidden ? "text" : "password");
        $(this).text(isHidden ? "Hide" : "Show");
    });

    // Register a prototype account and keep it in localStorage.
    $("#register-form").on("submit", function (event) {
        event.preventDefault();

        const form = this;
        if (!form.checkValidity()) {
            form.reportValidity();
            showMessage("#register-message", "Please complete all required fields correctly.", "error");
            return;
        }

        const fullName = $("#name").val().trim();
        const email = $("#register-email").val().trim();
        const mnsuId = $("#register-id").val().trim();
        const password = $("#register-password").val();
        const role = $("#register-role").val();

        if (!emailLooksLikeMnsu(email)) {
            showMessage("#register-message", "Please use an @mnsu.edu email address.", "error");
            return;
        }

        const accounts = getAccounts();
        const accountExists = accounts.some(function (account) {
            return account.mnsuId.toLowerCase() === mnsuId.toLowerCase();
        });

        if (accountExists) {
            showMessage("#register-message", "An account with that MNSU ID already exists.", "error");
            return;
        }

        accounts.push({
            fullName: fullName,
            email: email,
            mnsuId: mnsuId,
            password: password,
            role: role
        });

        saveAccounts(accounts);
        showMessage("#register-message", "Account created. You can now log in.", "success");

        // Copy the new ID and role into the login form to make testing easier.
        $("#login-id").val(mnsuId);
        $("#login-role").val(role);
        form.reset();
        $("#login-password").focus();
    });

    // Validate login details and redirect to the selected portal.
    $("#login-form").on("submit", function (event) {
        event.preventDefault();

        const form = this;
        if (!form.checkValidity()) {
            form.reportValidity();
            showMessage("#login-message", "Please enter your ID, password and role.", "error");
            return;
        }

        const mnsuId = $("#login-id").val().trim();
        const password = $("#login-password").val();
        const role = $("#login-role").val();
        const accounts = getAccounts();

        const matchingAccount = accounts.find(function (account) {
            return account.mnsuId.toLowerCase() === mnsuId.toLowerCase() &&
                account.password === password &&
                account.role === role;
        });

        if (!matchingAccount) {
            showMessage(
                "#login-message",
                "Login information does not match a registered account.",
                "error"
            );
            return;
        }

        // Save only basic session information for the Phase 2 prototype.
        localStorage.setItem("campusEcoCurrentUser", JSON.stringify({
            fullName: matchingAccount.fullName,
            mnsuId: matchingAccount.mnsuId,
            role: matchingAccount.role
        }));

        showMessage("#login-message", "Login successful. Opening your portal...", "success");

        window.setTimeout(function () {
            window.location.href = rolePages[role];
        }, 500);
    });
});
