/* Phase 3 Kiran: keep the existing Phase 2 login/register forms and switch to PHP + MariaDB. */
$(function () {
  const api = window.CampusEco;
  const pages = { operator: 'operator.html', driver: 'driver.html', recipient: 'recipient.html' };
  $('.password-toggle').on('click', function () {
    const field = $('#' + $(this).data('target'));
    const show = field.attr('type') === 'password';
    field.attr('type', show ? 'text' : 'password');
    $(this).text(show ? 'Hide' : 'Show');
  });
  function msg(id, text, isError = true) {
    $(id).text(text).removeClass('success error').addClass(isError ? 'error' : 'success');
  }
  $('#register-form').on('submit', async function (e) {
    e.preventDefault();
    if (!this.checkValidity()) { this.reportValidity(); return; }
    const data = {
      fullName: $('#name').val().trim(), email: $('#register-email').val().trim(),
      mnsuId: $('#register-id').val().trim(), password: $('#register-password').val(),
      role: $('#register-role').val()
    };
    try {
      await api.post('api/auth.php?action=register', data);
      msg('#register-message', 'Account created in the database. You can now log in.', false);
      $('#register-password').val('');
    } catch (err) { msg('#register-message', err.message); }
  });
  $('#login-form').on('submit', async function (e) {
    e.preventDefault();
    if (!this.checkValidity()) { this.reportValidity(); return; }
    try {
      const result = await api.post('api/auth.php?action=login', {
        mnsuId: $('#login-id').val().trim(), password: $('#login-password').val(), role: $('#login-role').val()
      });
      api.user = result.user; api.csrf = result.csrf;
      msg('#login-message', 'Login successful. Opening dashboard...', false);
      location.assign(pages[result.user.role]);
    } catch (err) { msg('#login-message', err.message); }
  });
});
