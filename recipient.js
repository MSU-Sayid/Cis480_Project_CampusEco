/* =========================================================
   MNSU CampusEco — Recipient portal (js/recipient.js)
   Reads/writes the shared localStorage key "packages"
   (same one driver.js uses), so driver updates show up here.
   ========================================================= */

$(function () {

    const PKG_KEY   = "packages";
    const PREF_KEY  = "recipientPrefs";
    const EMAIL_KEY = "recipientEmail";
    const STAGES    = ["Received at Hub", "Assigned to Driver", "Loaded", "En Route", "Delivered"];

    /* ---------- Task 2.1: Package object ---------- */

    // Wraps the raw object stored in localStorage and adds behaviour.
    function Package(raw) {
        this.raw = raw;
    }

    // 0-4 position on the recipient timeline.
    // "Assigned to Driver" isn't a driver status; it means the package was claimed.
    Package.prototype.stageIndex = function () {
        const s = this.raw.status;
        if (s === "Delivered") return 4;
        if (s === "En Route")  return 3;
        if (s === "Loaded")    return 2;
        return this.raw.claimed ? 1 : 0;
    };
    Package.prototype.stage       = function () { return STAGES[this.stageIndex()]; };
    Package.prototype.isDelivered = function () { return this.raw.status === "Delivered"; };
    Package.prototype.isSigned    = function () { return !!this.raw.signedOff; };
    Package.prototype.progress    = function () { return Math.round(this.stageIndex() / (STAGES.length - 1) * 100); };

    // Rough estimate: fixed trip saving + a little more for heavier loads (kg CO2)
    Package.prototype.carbonSaved = function () {
        return 0.4 + 0.04 * (Number(this.raw.weight) || 0);
    };

    // Timeline of events for the notification list (newest first)
    Package.prototype.events = function () {
        const id = this.raw.trackingNumber;
        const list = [];
        list.push({ text: id + " was received at the hub.", time: this.raw.checkedInAt || null });
        if (this.raw.claimedAt) {
            list.push({ text: id + " was assigned to a driver.", time: this.raw.claimedAt });
        }
        (this.raw.history || []).forEach(function (h) {
            list.push({ text: id + " is now " + h.status + ".", time: h.time });
        });
        if (this.raw.signedOff) {
            list.push({ text: "You signed for " + id + ".", time: this.raw.signedOff.time });
        }
        return list.reverse();
    };

    /* ---------- localStorage helpers ---------- */

    function load(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            showMessage("Could not save. Browser storage is unavailable.", "error");
            return false;
        }
    }

    /* ---------- state ---------- */

    let packages = load(PKG_KEY, []);
    let email    = load(EMAIL_KEY, "");
    let prefs    = load(PREF_KEY, { location: "", notify: true, signature: false });
    let selectedId = "";

    function myPackages() {
        const e = String(email).trim().toLowerCase();
        return packages
            .filter(function (p) { return String(p.recipient || "").toLowerCase() === e; })
            .map(function (p) { return new Package(p); });
    }

    function selectedPackage() {
        return myPackages().find(function (p) { return p.raw.trackingNumber === selectedId; });
    }

    /* ---------- messages ---------- */

    let messageTimer;
    function showMessage(text, type) {
        const $msg = $("#recipient-message");
        clearTimeout(messageTimer);
        $msg.stop(true, true)
            .attr("class", "msg msg-" + (type || "success"))
            .text(text)
            .prop("hidden", false)
            .hide()
            .fadeIn(200);
        messageTimer = setTimeout(function () {
            $msg.fadeOut(300, function () { $msg.prop("hidden", true); });
        }, type === "error" ? 6000 : 4000);
    }

    function formatTime(iso) {
        if (!iso) return "";
        return new Date(iso).toLocaleString([], {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
        });
    }

    function slug(text) {
        return String(text || "").toLowerCase().replace(/\s+/g, "-");
    }

    /* ---------- rendering ---------- */

    function renderSelect() {
        const mine = myPackages();
        const $sel = $("#package-select").empty();

        $("#no-packages").prop("hidden", mine.length > 0 || !email);
        $("#tracking-details").toggle(mine.length > 0);

        if (mine.length === 0) {
            $sel.append($("<option>", { value: "" }).text(email ? "No packages found" : "Enter your email first"));
            selectedId = "";
            return;
        }

        mine.forEach(function (p) {
            $sel.append($("<option>", { value: p.raw.trackingNumber })
                .text(p.raw.trackingNumber + " — " + p.stage()));
        });

        const stillThere = mine.some(function (p) { return p.raw.trackingNumber === selectedId; });
        if (!stillThere) selectedId = mine[0].raw.trackingNumber;
        $sel.val(selectedId);
    }

    function renderTracking() {
        const pkg = selectedPackage();
        if (!pkg) return;

        $("#tracking-number").text(pkg.raw.trackingNumber);
        $("#tracking-destination").text(pkg.raw.destination || "—");
        $("#tracking-status")
            .attr("class", "badge badge-" + slug(pkg.stage()))
            .text(pkg.stage());

        const $list = $("#tracking-list").empty();
        const current = pkg.stageIndex();
        STAGES.forEach(function (name, i) {
            $("<li>")
                .text(name)
                .toggleClass("done", i < current || pkg.isDelivered())
                .toggleClass("current", i === current && !pkg.isDelivered())
                .attr("aria-current", i === current ? "step" : null)
                .appendTo($list);
        });

        // Animate the progress bar to its new width
        $(".progress").attr("aria-valuenow", pkg.progress());
        $("#progress-fill").stop(true).animate({ width: pkg.progress() + "%" }, 500);
    }

    function renderNotifications() {
        const pkg = selectedPackage();
        const $list = $("#notification-list").empty();
        const $count = $("#notif-count");

        if (!prefs.notify) {
            $list.append($("<li>", { "class": "empty" })
                .text("Notifications are turned off. Turn them on in Delivery Preferences."));
            $count.prop("hidden", true);
            return;
        }
        if (!pkg) {
            $list.append($("<li>", { "class": "empty" }).text("No notifications yet."));
            $count.prop("hidden", true);
            return;
        }

        const events = pkg.events();
        events.forEach(function (ev) {
            const $li = $("<li>").append($("<span>").text(ev.text));
            if (ev.time) $li.append($("<time>").text(formatTime(ev.time)));
            $list.append($li);
        });
        $count.text(events.length).prop("hidden", false);
    }

    function renderPreferences() {
        $("#location").val(prefs.location || "");
        $("#notify").prop("checked", !!prefs.notify);
        $("#signature").prop("checked", !!prefs.signature);
    }

    function renderSignoff() {
        const pkg = selectedPackage();
        const $fields = $("#signoff-form").find("input, button");
        const $hint = $("#signoff-hint");

        if (!pkg) {
            $fields.prop("disabled", true);
            $hint.text("Select a package to sign off.");
            return;
        }
        if (pkg.isSigned()) {
            $fields.prop("disabled", true);
            $("#recipient-name").val(pkg.raw.signedOff.name);
            $("#confirm").prop("checked", true);
            $hint.text("Signed by " + pkg.raw.signedOff.name + " on " + formatTime(pkg.raw.signedOff.time) + ".");
            return;
        }
        if (!pkg.isDelivered()) {
            $fields.prop("disabled", true);
            $hint.text("Sign-off opens once the driver marks " + pkg.raw.trackingNumber + " as Delivered.");
            return;
        }
        $fields.prop("disabled", false);
        $hint.text(prefs.signature
            ? "A signature is required for your packages. Type your full name below."
            : "Confirm that you received " + pkg.raw.trackingNumber + ".");
    }

    function renderCarbon() {
        const pkg = selectedPackage();
        $("#carbon-this").text(pkg ? pkg.carbonSaved().toFixed(1) + " kg" : "0.0 kg");

        const total = myPackages()
            .filter(function (p) { return p.isDelivered(); })
            .reduce(function (sum, p) { return sum + p.carbonSaved(); }, 0);
        $("#carbon-total").text(total.toFixed(1) + " kg");
    }

    function renderAll() {
        renderSelect();
        renderTracking();
        renderNotifications();
        renderSignoff();
        renderCarbon();
    }

    /* ---------- events ---------- */

    // Look up packages by email
    $("#email-form").on("submit", function (e) {
        e.preventDefault();
        email = $.trim($("#recipient-email").val());
        save(EMAIL_KEY, email);
        selectedId = "";
        packages = load(PKG_KEY, []);
        renderAll();
        if (myPackages().length === 0) {
            showMessage("No packages found for " + email + ".", "error");
        }
    });

    // Switch package
    $("#package-select").on("change", function () {
        selectedId = $(this).val();
        renderTracking();
        renderNotifications();
        renderSignoff();
        renderCarbon();
    });

    // Slide the preferences panel open/closed
    $("#toggle-prefs").on("click", function () {
        const $btn = $(this);
        $("#prefs-panel").slideToggle(250, function () {
            const open = $(this).is(":visible");
            $btn.text(open ? "Hide preferences" : "Edit preferences").attr("aria-expanded", open);
        });
    });

    // Save preferences
    $("#prefs-form").on("submit", function (e) {
        e.preventDefault();
        prefs = {
            location: $("#location").val(),
            notify: $("#notify").is(":checked"),
            signature: $("#signature").is(":checked")
        };
        if (save(PREF_KEY, prefs)) {
            showMessage("Preferences saved. Deliveries go to: " + prefs.location + ".", "success");
            renderNotifications();
            renderSignoff();
        }
    });

    // Electronic sign-off
    $("#signoff-form").on("submit", function (e) {
        e.preventDefault();
        const pkg = selectedPackage();
        const name = $.trim($("#recipient-name").val());

        if (!pkg || !pkg.isDelivered()) {
            showMessage("You can sign off after the package is delivered.", "error");
            return;
        }
        if (name.length < 2) {
            showMessage("Enter your full name to sign.", "error");
            return;
        }

        pkg.raw.signedOff = { name: name, time: new Date().toISOString() };
        if (save(PKG_KEY, packages)) {
            showMessage("Thanks, " + name + ". Delivery of " + pkg.raw.trackingNumber + " is signed off.", "success");
            renderAll();
        }
    });

    // Live updates when the driver changes a package in another tab
    $(window).on("storage", function (e) {
        if (e.originalEvent.key === PKG_KEY) {
            packages = load(PKG_KEY, []);
            renderAll();
        }
    });

    /* ---------- start ---------- */

    // First visit: default to the first recipient found so the page isn't empty
    if (!email && packages.length > 0) {
        email = packages[0].recipient || "";
    }
    $("#recipient-email").val(email);
    renderPreferences();
    renderAll();
});