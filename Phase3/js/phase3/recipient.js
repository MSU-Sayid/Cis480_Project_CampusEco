/* Phase 3 Priyanka: AngularJS model binding plus existing Phase 2 recipient controls.
   The signed-in session determines which packages are visible, not the email textbox. */
angular.module('campusEcoRecipient', []).controller('RecipientController', ['$scope', function ($scope) {
  const api = window.CampusEco;
  const stages = ['Received at Hub','Assigned to Driver','Loaded','En Route','Delivered'];
  $scope.selected = {};
  let packages = [];
  const message = (text, error = false) => $('#recipient-message').text(text)
    .removeClass('msg-success msg-error').addClass(error ? 'msg-error' : 'msg-success').prop('hidden', false);
  const selected = () => packages.find(p => String(p.id) === String($('#package-select').val()));
  const display = (p) => {
    $scope.$applyAsync(() => { $scope.selected = p || {}; });
    if (!p) {
      $('#tracking-number,#tracking-destination').text('—'); $('#tracking-list,#notification-list').empty();
      $('#progress-fill').css('width','0%'); $('.progress').attr('aria-valuenow',0);
      $('#carbon-this').text('0.0 kg'); $('#signoff-hint').text('Select a delivered package to sign off.');
      $('#signoff-btn').prop('disabled',true);return;
    }
    $('#tracking-number').text(p.tracking_number); $('#tracking-destination').text(p.destination);
    const index = Math.max(0,stages.indexOf(p.status));
    $('#progress-fill').css('width', `${Math.round(index/4*100)}%`);
    $('.progress').attr('aria-valuenow',Math.round(index/4*100));
    const timeline=$('#tracking-list').empty();
    stages.forEach((stage,i)=>timeline.append($('<li>').text(`${i<=index?'✓ ':'○ '}${stage}`)));
    const saved = (0.4+0.04*Number(p.weight||0)).toFixed(2);
    $('#carbon-this').text(`${saved} kg (demo estimate)`);
    $('#signoff-btn').prop('disabled',p.status!=='Delivered'||Boolean(p.signed_at));
    $('#signoff-hint').text(p.signed_at?`Signed by ${p.signed_by}`:p.status==='Delivered'?'Confirm receipt of this package.':'Delivery must be marked Delivered before sign-off.');
    loadEvents(p.id);
  };
  async function loadEvents(id){
    try{
      const result=await api.request(`api/packages.php?action=events&id=${encodeURIComponent(id)}`);
      if(String($('#package-select').val())!==String(id))return;
      const list=$('#notification-list').empty();
      result.events.forEach(event=>list.append($('<li>').text(`${event.status} — ${event.created_at}`)));
      $('#notif-count').text(result.events.length).prop('hidden',false);
    }catch(err){message(err.message,true);}
  }
  async function refresh(){
    const result=await api.request('api/packages.php?action=list');
    packages=result.packages;
    const before=$('#package-select').val();
    const options=$('#package-select').empty();
    packages.forEach(p=>options.append($('<option>').val(p.id).text(`${p.tracking_number} — ${p.status}`)));
    if(before && packages.some(p=>String(p.id)===String(before)))options.val(before);
    $('#no-packages').prop('hidden',packages.length>0);
    display(selected());
    $('#carbon-total').text(`${packages.filter(p=>p.status==='Delivered').reduce((sum,p)=>sum+0.4+0.04*Number(p.weight||0),0).toFixed(2)} kg (demo estimate)`);
  }
  $('#package-select').on('change',()=>display(selected()));
  $('#email-form').on('submit',async e=>{e.preventDefault();try{await refresh();}catch(err){message(err.message,true);}});
  $('#toggle-prefs').on('click',function(){const panel=$('#prefs-panel');panel.toggle();$(this).attr('aria-expanded',panel.is(':visible')).text(panel.is(':visible')?'Hide preferences':'Show preferences');});
  $('#prefs-form').on('submit',async function(e){
    e.preventDefault();if(!this.checkValidity()){this.reportValidity();return;}
    try{await api.post('api/preferences.php',{location:$('#location').val(),notify:$('#notify').is(':checked'),signature:$('#signature').is(':checked')});message('Delivery preferences saved to MariaDB.');}
    catch(err){message(err.message,true);}
  });
  $('#signoff-form').on('submit',async function(e){
    e.preventDefault();if(!this.checkValidity()){this.reportValidity();return;}
    const p=selected();if(!p){message('Select a package.',true);return;}
    if(!$('#confirm').is(':checked')){message('Please confirm receipt.',true);return;}
    try{await api.post('api/packages.php?action=signoff',{id:Number(p.id),name:$('#recipient-name').val().trim()});message('Delivery signed off.');await refresh();}
    catch(err){message(err.message,true);}
  });
  (async()=>{
    try{
      const user=await api.session('recipient');
      $('#recipient-email').val(user.email);
      $('a[data-logout]').on('click',async e=>{e.preventDefault();await api.logout();});
      const prefs=await api.request('api/preferences.php');
      if(prefs.preferences){$('#location').val(prefs.preferences.preferred_location);$('#notify').prop('checked',Boolean(Number(prefs.preferences.notify)));$('#signature').prop('checked',Boolean(Number(prefs.preferences.signature_required)));}
      await refresh();
    }catch(err){if(!String(err.message).includes('Login required'))message(err.message,true);}
  })();
}]);
