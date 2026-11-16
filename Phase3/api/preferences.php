<?php
require __DIR__.'/../server/bootstrap.php';$u=user('recipient');
if($_SERVER['REQUEST_METHOD']==='GET') {
 $s=db()->prepare('SELECT preferred_location,notify,signature_required FROM delivery_preferences WHERE user_id=?');$s->execute([$u['id']]);reply(['preferences'=>$s->fetch()?:null]);
}
method('POST');csrf();$d=data();$location=trim((string)($d['location']??''));
if(!in_array($location,['Front Desk','Package Locker','Department Office'],true)) reply(['error'=>'Select a valid location'],422);
$s=db()->prepare('INSERT INTO delivery_preferences(user_id,preferred_location,notify,signature_required) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE preferred_location=VALUES(preferred_location),notify=VALUES(notify),signature_required=VALUES(signature_required)');
$s->execute([$u['id'],$location,!empty($d['notify'])?1:0,!empty($d['signature'])?1:0]);reply(['ok'=>true]);
