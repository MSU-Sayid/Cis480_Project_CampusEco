
/* MNSU CampusEco - Operator Dashboard
   Phase 2: JavaScript, jQuery, and localStorage
*/

$(function () {
    const PKG_KEY = "packages";

    // Load packages shared with Driver and Recipient
    function loadPackages() {
        try {
            return JSON.parse(localStorage.getItem(PKG_KEY)) || [];
        } catch (error) {
            return [];
        }
    }

    let packages = loadPackages();

    // Display feedback messages
    function showMessage(message, type = "success") {
        $("#operator-message")
            .removeClass("msg-success msg-error")
            .addClass("msg-" + type)
            .text(message)
            .prop("hidden", false);
    }

    // Package object - Task 2.1
    function Package(tracking, recipient, weight, destination,
                     size, priority, fragile, signature) {
        this.trackingNumber = tracking;
        this.recipient = recipient;
        this.weight = weight;
        this.destination = destination;
        this.size = size;
        this.priority = priority;
        this.fragile = fragile;
        this.signatureRequired = signature;
        this.status = "Received at Hub";
        this.claimed = false;
        this.checkedInAt = new Date().toISOString();
        this.history = [];
    }

    // Render package tracking table - Task 2.2
    function renderPackages() {
        const $tbody = $("#operator-packages");
        $tbody.empty();

        if (packages.length === 0) {
            $("<tr>").append(
                $("<td>", { colspan: 4 })
                    .text("No packages checked in yet.")
            ).appendTo($tbody);
            return;
        }

        packages.forEach(function (pkg) {
            const $row = $("<tr>");

            $("<td>").text(pkg.trackingNumber).appendTo($row);
            $("<td>").text(pkg.destination).appendTo($row);
            $("<td>").text(pkg.priority).appendTo($row);
            $("<td>").text(pkg.status).appendTo($row);

            $tbody.append($row);
        });
    }

    // Handle package check-in
    $("#checkin-form").on("submit", function (event) {
        event.preventDefault();

        const tracking = $("#tracking").val().trim().toUpperCase();
        const recipient = $("#email").val().trim().toLowerCase();
        const weight = Number($("#weight").val());
        const destination = $("#destination").val();
        const size = $("input[name='size']:checked").val();
        const priority = $("input[name='priority']:checked").val();
        const fragile = $("input[name='fragile']").is(":checked");
        const signature = $("input[name='signature']").is(":checked");

        // Shared tracking format
        if (!/^MNSU-\d{6}$/.test(tracking)) {
            showMessage(
                "Tracking number must use MNSU- followed by 6 digits.",
                "error"
            );
            return;
        }

        if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
            showMessage("Enter a valid recipient email.", "error");
            return;
        }

        if (!Number.isFinite(weight) || weight < 0.1 || weight > 100) {
            showMessage("Weight must be between 0.1 and 100 lbs.", "error");
            return;
        }

        if (!destination || !size || !priority) {
            showMessage("Please complete all required fields.", "error");
            return;
        }

        // Reload before saving to avoid using old data
        packages = loadPackages();

        // Prevent duplicate tracking numbers
        const exists = packages.some(function (pkg) {
            return pkg.trackingNumber === tracking;
        });

        if (exists) {
            showMessage("This tracking number already exists.", "error");
            return;
        }

        const newPackage = new Package(
            tracking,
            recipient,
            weight,
            destination,
            size,
            priority === "urgent" ? "Urgent" : "Normal",
            fragile,
            signature
        );

        packages.push(newPackage);

        try {
            localStorage.setItem(PKG_KEY, JSON.stringify(packages));
        } catch (error) {
            packages.pop();
            showMessage("Unable to save package in browser storage.", "error");
            return;
        }

        renderPackages();
        this.reset();

        showMessage(
            "Package " + tracking + " checked in successfully."
        );
    });

    // Update when another dashboard changes packages
    $(window).on("storage", function (event) {
        if (event.originalEvent.key === PKG_KEY) {
            packages = loadPackages();
            renderPackages();
        }
    });

    // Initial display
    renderPackages();
});
