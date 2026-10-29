/* =========================================================
   MNSU CampusEco — Driver portal (js/driver.js)
   Reads and writes the shared localStorage key "packages"
   that the Operator portal creates and the Recipient portal reads.
   Status flow: Received at Hub -> Loaded -> En Route -> Delivered
   ========================================================= */

$(function () {

    const PKG_KEY = "packages";          // shared with operator.js / recipient.js
    const VEH_KEY = "driverVehicles";    // driver-only data
    const STAGES  = ["Received at Hub", "Loaded", "En Route", "Delivered"];
    const LOW_BATTERY = 20;

    // Demo data, used only if no one has saved packages yet
    const DEMO_PACKAGES = [
        { trackingNumber: "MNSU-123456", recipient: "student@mnsu.edu", destination: "Preska Hall",
          weight: 5, priority: "Normal", status: "Received at Hub" },
        { trackingNumber: "MNSU-678901", recipient: "faculty@mnsu.edu", destination: "CSU",
          weight: 2, priority: "Urgent", status: "Received at Hub" }
    ];
    const DEFAULT_VEHICLES = [
        { name: "Eco Cart 1", battery: 85 },
        { name: "Eco Cart 2", battery: 62 }
    ];

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
            showMessage("Could not save — browser storage is unavailable.", "error");
            return false;
        }
    }

    // Seed demo packages only the first time (key never set)
    if (localStorage.getItem(PKG_KEY) === null) {
        save(PKG_KEY, DEMO_PACKAGES);
    }

    let packages = load(PKG_KEY, []);
    let vehicles = load(VEH_KEY, DEFAULT_VEHICLES);

    /* ---------- helpers ---------- */

    function stageIndex(status) {
        const i = STAGES.indexOf(status);
        return i === -1 ? 0 : i;          // unknown status = still at hub
    }

    function slug(text) {
        return String(text || "").toLowerCase().replace(/\s+/g, "-");
    }

    function findPackage(id) {
        return packages.find(function (p) { return p.trackingNumber === id; });
    }

    let messageTimer;
    function showMessage(text, type) {
        const $msg = $("#driver-message");
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

    /* ---------- rendering ---------- */

    function renderQueue() {
        const $body = $("#queue-body").empty();

        if (packages.length === 0) {
            $body.append(
                $("<tr>").append(
                    $("<td>", { colspan: 6, "class": "empty" })
                        .text("No packages checked in yet.")
                )
            );
        }

        packages.forEach(function (p) {
            const claimed = !!p.claimed;
            const done = p.status === "Delivered";
            const $tr = $("<tr>")
                .toggleClass("is-claimed", claimed)
                .toggleClass("is-done", done);

            $("<td>", { "data-label": "Select" }).append(
                $("<input>", {
                    type: "checkbox",
                    "class": "pick",
                    value: p.trackingNumber,
                    disabled: claimed,
                    "aria-label": "Select " + p.trackingNumber
                })
            ).appendTo($tr);

            $("<td>", { "data-label": "Tracking" }).text(p.trackingNumber).appendTo($tr);
            $("<td>", { "data-label": "Destination" }).text(p.destination || "—").appendTo($tr);

            $("<td>", { "data-label": "Priority" })
                .text(p.priority || "Normal")
                .toggleClass("priority-urgent", /urgent|high/i.test(p.priority || ""))
                .appendTo($tr);

            const status = p.status || STAGES[0];
            $("<td>", { "data-label": "Status" }).append(
                $("<span>", { "class": "badge badge-" + slug(status) }).text(status)
            ).appendTo($tr);

            const $btn = $("<button>", { type: "button", "class": "claim-btn" })
                .attr("data-id", p.trackingNumber);
            if (claimed) {
                $btn.text(done ? "Done" : "Claimed").prop("disabled", true);
            } else {
                $btn.text("Claim");
            }
            $("<td>", { "data-label": "Action" }).append($btn).appendTo($tr);

            $body.append($tr);
        });

        const open = packages.filter(function (p) { return !p.claimed; }).length;
        const mine = packages.filter(function (p) { return p.claimed && p.status !== "Delivered"; }).length;
        $("#queue-summary").text(open + " available · " + mine + " in your route");
        $("#select-all").prop("checked", false).prop("disabled", open === 0);
    }

    function renderPackageSelect() {
        const $sel = $("#package");
        const current = $sel.val();
        const mine = packages.filter(function (p) {
            return p.claimed && p.status !== "Delivered";
        });

        $sel.empty().append($("<option>", { value: "" }).text(
            mine.length ? "Select package" : "Claim a delivery first"
        ));
        mine.forEach(function (p) {
            $sel.append($("<option>", { value: p.trackingNumber })
                .text(p.trackingNumber + " — " + (p.destination || "")));
        });

        if (current && findPackage(current) && mine.some(function (p) { return p.trackingNumber === current; })) {
            $sel.val(current);
        }
        updateHint();
    }

    // Show current status and pre-select the next stage
    function updateHint() {
        const p = findPackage($("#package").val());
        if (!p) {
            $("#status-hint").text("");
            return;
        }
        const i = stageIndex(p.status);
        const next = STAGES[i + 1];
        $("#status-hint").text("Current: " + STAGES[i] + (next ? " → next: " + next : ""));
        if (next) $("#status").val(next);
    }

    function renderBattery() {
        const $grid = $("#battery-cards").empty();
        vehicles.forEach(function (v) {
            const level = v.battery < LOW_BATTERY ? "low" : v.battery < 50 ? "mid" : "ok";
            const $card = $("<div>", { "class": "battery-card battery-" + level });
            $("<h3>").text(v.name).appendTo($card);
            $("<p>", { "class": "battery-pct" }).text(v.battery + "%").appendTo($card);
            $("<div>", {
                "class": "battery-bar",
                role: "meter",
                "aria-valuemin": 0,
                "aria-valuemax": 100,
                "aria-valuenow": v.battery,
                "aria-label": v.name + " battery"
            }).append($("<span>").css("width", v.battery + "%")).appendTo($card);
            if (level === "low") {
                $("<p>", { "class": "battery-warn" }).text("Charge before next run").appendTo($card);
            }
            if (v.updatedAt) {
                $("<p>", { "class": "battery-time" })
                    .text("Updated " + new Date(v.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))
                    .appendTo($card);
            }
            $grid.append($card);
        });
    }

    function renderAll() {
        renderQueue();
        renderPackageSelect();
        renderBattery();
    }

    /* ---------- claiming ---------- */

    function claim(ids) {
        const claimed = [];
        ids.forEach(function (id) {
            const p = findPackage(id);
            if (p && !p.claimed) {
                p.claimed = true;
                p.claimedAt = new Date().toISOString();
                claimed.push(id);
            }
        });

        if (claimed.length === 0) {
            showMessage("Those deliveries were already claimed.", "error");
            return;
        }
        if (save(PKG_KEY, packages)) {
            renderAll();
            showMessage("Claimed " + claimed.join(", ") + ". Added to your route.", "success");
        }
    }

    $("#queue-body").on("click", ".claim-btn", function () {
        claim([$(this).attr("data-id")]);
    });

    $("#claim-selected").on("click", function () {
        const ids = $(".pick:checked").map(function () { return this.value; }).get();
        if (ids.length === 0) {
            showMessage("Select at least one delivery to claim.", "error");
            return;
        }
        claim(ids);
    });

    $("#select-all").on("change", function () {
        $(".pick:not(:disabled)").prop("checked", this.checked);
    });

    // Keep "select all" in sync when individual boxes change
    $("#queue-body").on("change", ".pick", function () {
        const $boxes = $(".pick:not(:disabled)");
        $("#select-all").prop("checked", $boxes.length > 0 && $boxes.length === $boxes.filter(":checked").length);
    });

    /* ---------- status updates ---------- */

    $("#package").on("change", updateHint);

    $("#status-form").on("submit", function (e) {
        e.preventDefault();
        const id = $("#package").val();
        const newStatus = $("#status").val();

        if (!id) {
            showMessage("Choose one of your claimed packages.", "error");
            return;
        }
        if (!newStatus) {
            showMessage("Choose a status.", "error");
            return;
        }

        const p = findPackage(id);
        if (!p) {
            showMessage("Package " + id + " was not found.", "error");
            return;
        }

        const cur = stageIndex(p.status);
        const next = STAGES.indexOf(newStatus);

        if (next <= cur) {
            showMessage(id + " is already " + STAGES[cur] + ".", "error");
            return;
        }
        if (next > cur + 1) {
            showMessage("Mark " + id + " as " + STAGES[cur + 1] + " first.", "error");
            return;
        }

        p.status = newStatus;
        p.statusUpdatedAt = new Date().toISOString();
        p.history = (p.history || []).concat({ status: newStatus, time: p.statusUpdatedAt });

        if (save(PKG_KEY, packages)) {
            renderAll();
            showMessage(id + " updated to " + newStatus + ".", "success");
            $("#status").val("");
            if (newStatus !== "Delivered") {
                $("#package").val(id);
                updateHint();
            }
        }
    });

    /* ---------- battery ---------- */

    $("#vehicle-form").on("submit", function (e) {
        e.preventDefault();
        const name = $("#vehicle").val();
        const raw = $.trim($("#battery").val());
        const level = Number(raw);

        if (!name) {
            showMessage("Choose a vehicle.", "error");
            return;
        }
        if (raw === "" || !Number.isInteger(level) || level < 0 || level > 100) {
            showMessage("Battery must be a whole number from 0 to 100.", "error");
            $("#battery").trigger("focus");
            return;
        }

        let v = vehicles.find(function (x) { return x.name === name; });
        if (!v) {
            v = { name: name };
            vehicles.push(v);
        }
        v.battery = level;
        v.updatedAt = new Date().toISOString();

        if (save(VEH_KEY, vehicles)) {
            renderBattery();
            this.reset();
            if (level < LOW_BATTERY) {
                showMessage(name + " is at " + level + "%. Charge it before the next run.", "warn");
            } else {
                showMessage(name + " battery updated to " + level + "%.", "success");
            }
        }
    });

    /* ---------- live sync with other tabs (e.g. Operator checks in a package) ---------- */

    $(window).on("storage", function (e) {
        if (e.originalEvent.key === PKG_KEY) {
            packages = load(PKG_KEY, []);
            renderQueue();
            renderPackageSelect();
        }
    });

    renderAll();
});
