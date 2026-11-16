/* Phase 3 Priscilla: retains Phase 2 operator form and tracking table IDs. */
$(async function () {
  const api = window.CampusEco;
  try { await api.session('operator'); } catch { return; }
  $('a[data-logout]').on('click', async e => { e.preventDefault(); await api.logout(); });
  const message = (text, error = false) => $('#operator-message').text(text)
    .removeClass('msg-success msg-error').addClass(error ? 'msg-error' : 'msg-success').prop('hidden', false);
  const row = p => $('<tr>')
    .append($('<td>').text(p.tracking_number))
    .append($('<td>').text(p.destination))
    .append($('<td>').text(p.priority))
    .append($('<td>').text(p.status));
  async function refresh() {
    const result = await api.request('api/packages.php?action=list');
    const tbody = $('#operator-packages').empty();
    if (!result.packages.length) tbody.append($('<tr>').append($('<td colspan="4">').text('No packages checked in yet.')));
    else result.packages.forEach(p => tbody.append(row(p)));
  }
  $('#checkin-form').on('submit', async function (event) {
    event.preventDefault();
    if (!this.checkValidity()) { this.reportValidity(); return; }
    const data = {
      trackingNumber: $('#tracking').val().trim().toUpperCase(),
      recipientEmail: $('#email').val().trim().toLowerCase(),
      weight: Number($('#weight').val()), destination: $('#destination').val(),
      size: $('input[name=size]:checked').val(), priority: $('input[name=priority]:checked').val(),
      fragile: $('input[name=fragile]').is(':checked'), signature: $('input[name=signature]').is(':checked')
    };
    try { await api.post('api/packages.php?action=checkin', data); this.reset(); message('Package checked in and saved to MariaDB.'); await refresh(); }
    catch (err) { message(err.message, true); }
  });
  try { await refresh(); } catch (err) { message(err.message, true); }
});
