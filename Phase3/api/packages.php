<?php
require __DIR__.'/../server/bootstrap.php';
$u=user();$action=$_GET['action']??'list';
if($_SERVER['REQUEST_METHOD']==='GET' && $action==='list'){
 if($u['role']==='operator') $s=db()->query('SELECT * FROM packages ORDER BY created_at DESC');
 elseif($u['role']==='driver') {$s=db()->prepare('SELECT * FROM packages WHERE driver_id IS NULL OR driver_id=? ORDER BY created_at DESC');$s->execute([$u['id']]);}
 else {$s=db()->prepare('SELECT * FROM packages WHERE recipient_email=? ORDER BY created_at DESC');$s->execute([$u['email']]);}
 reply(['packages'=>$s->fetchAll()]);
}
if($_SERVER['REQUEST_METHOD']==='GET' && $action==='events'){
 $id=(int)($_GET['id']??0);
 $sql='SELECT id FROM packages WHERE id=?';$args=[$id];
 if($u['role']==='recipient'){$sql.=' AND recipient_email=?';$args[]=$u['email'];}
 elseif($u['role']==='driver'){$sql.=' AND driver_id=?';$args[]=$u['id'];}
 $check=db()->prepare($sql);$check->execute($args);
 if(!$check->fetch()) reply(['error'=>'Package not found'],404);
 $events=db()->prepare('SELECT status,created_at FROM transit_events WHERE package_id=? ORDER BY id');
 $events->execute([$id]);reply(['events'=>$events->fetchAll()]);
}
method('POST');csrf();$d=data();
if($action==='checkin'){
 user('operator');$tracking=requiredString($d,'trackingNumber');$email=strtolower(requiredString($d,'recipientEmail'));
 $dest=requiredString($d,'destination');$size=requiredString($d,'size');$priority=requiredString($d,'priority');$weight=filter_var($d['weight']??null,FILTER_VALIDATE_FLOAT);
 if(!validTracking($tracking) || !preg_match('/^[^\s@]+@mnsu\.edu$/i',$email) || strlen($dest)>100 || !$dest || $weight===false || $weight<0.1 || $weight>100 || !in_array($size,['small','medium','large'],true) || !in_array($priority,['normal','urgent'],true)) reply(['error'=>'Invalid package data. Use MNSU-123456 tracking and weight 0.1–100 lbs'],422);
 try { $s=db()->prepare('INSERT INTO packages(tracking_number,recipient_email,destination,weight,size,priority,fragile,signature_required) VALUES(?,?,?,?,?,?,?,?)');
 $s->execute([$tracking,$email,$dest,$weight,$size,$priority,!empty($d['fragile'])?1:0,!empty($d['signature'])?1:0]);
 $event=db()->prepare("INSERT INTO transit_events(package_id,user_id,status) VALUES(?,?,'Received at Hub')");$event->execute([(int)db()->lastInsertId(),$u['id']]); }
 catch(PDOException $e){if($e->getCode()==='23000') reply(['error'=>'Tracking number already exists'],409);throw $e;}
 reply(['ok'=>true],201);
}
if($action==='claim'){
 user('driver');$id=(int)($d['id']??0);
 $s=db()->prepare("UPDATE packages SET driver_id=?,status='Assigned to Driver' WHERE id=? AND driver_id IS NULL AND status='Received at Hub'");$s->execute([$u['id'],$id]);
 if(!$s->rowCount()) reply(['error'=>'Package is unavailable or already claimed'],409);
 $ev=db()->prepare("INSERT INTO transit_events(package_id,user_id,status) VALUES(?,?,'Assigned to Driver')");$ev->execute([$id,$u['id']]);reply(['ok'=>true]);
}
if($action==='status'){
 user('driver');$id=(int)($d['id']??0);$next=requiredString($d,'status');
 $allowed=['Assigned to Driver'=>'Loaded','Loaded'=>'En Route','En Route'=>'Delivered'];
 $s=db()->prepare('SELECT status FROM packages WHERE id=? AND driver_id=?');$s->execute([$id,$u['id']]);$row=$s->fetch();
 if(!$row || ($allowed[$row['status']]??null)!==$next) reply(['error'=>'Invalid delivery transition or not your package'],409);
 $s=db()->prepare('UPDATE packages SET status=? WHERE id=? AND driver_id=? AND status=?');$s->execute([$next,$id,$u['id'],$row['status']]);
 if(!$s->rowCount()) reply(['error'=>'Status changed; refresh'],409);
 $ev=db()->prepare('INSERT INTO transit_events(package_id,user_id,status) VALUES(?,?,?)');$ev->execute([$id,$u['id'],$next]);reply(['ok'=>true]);
}
if($action==='signoff'){
 user('recipient');$id=(int)($d['id']??0);$name=requiredString($d,'name');
 if(strlen($name)<2 || strlen($name)>100) reply(['error'=>'Provide your name'],422);
 $s=db()->prepare("UPDATE packages SET signed_by=?,signed_at=NOW() WHERE id=? AND recipient_email=? AND status='Delivered' AND signed_at IS NULL");$s->execute([$name,$id,$u['email']]);
 if(!$s->rowCount()) reply(['error'=>'Package not delivered, already signed, or does not belong to you'],409);
 reply(['ok'=>true]);
}
reply(['error'=>'Unknown action'],404);
