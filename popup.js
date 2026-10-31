document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('extension-toggle');
    const statusLabel = document.getElementById('status-label');

    // Haal de huidige status op uit het geheugen
    chrome.storage.local.get(['systeemActief'], (data) => {
        const isActief = !!data.systeemActief;
        toggle.checked = isActief;
        statusLabel.innerText = isActief ? "Status: AAN" : "Status: UIT";
    });

    // Luister naar veranderingen in de toggle
    toggle.addEventListener('change', () => {
        const isActief = toggle.checked;
        statusLabel.innerText = isActief ? "Status: AAN" : "Status: UIT";

        // Sla de nieuwe status op
        chrome.storage.local.set({ systeemActief: isActief });

        // Stuur een bericht naar het actieve tabblad om de GUI te tonen/verbergen
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
                chrome.tabs.sendMessage(tabs[0].id, { actie: "updateStatus", isActief: isActief });
            }
        });
    });
});
