<?php
require __DIR__.'/../server/bootstrap.php';
$action=$_GET['action']??'';
if($action==='me') { method('GET'); reply(['user'=>$_SESSION['user']??null,'csrf'=>$_SESSION['csrf']??null]); }
if($action==='logout') {method('POST'); csrf(); $_SESSION=[]; session_destroy(); reply(['ok'=>true]); }
method('POST');
$d=data();
if($action==='register'){
 $name=requiredString($d,'fullName');$email=strtolower(requiredString($d,'email'));
 $id=requiredString($d,'mnsuId');$pw=(string)($d['password']??'');$role=requiredString($d,'role');
 if(strlen($name)<2 || strlen($name)>100 || !preg_match('/^[^\s@]+@mnsu\.edu$/i',$email) || !preg_match('/^[A-Za-z0-9]{6,20}$/',$id) || strlen($pw)<8 || !in_array($role,['operator','driver','recipient'],true)) reply(['error'=>'Check name, MNSU email, ID, password (8+ characters), and role'],422);
 // Classroom prototype: self-registration of staff roles must be disabled for a real deployment.
 try { $s=db()->prepare('INSERT INTO users(full_name,email,mnsu_id,password_hash,role) VALUES(?,?,?,?,?)');
  $s->execute([$name,$email,$id,password_hash($pw,PASSWORD_DEFAULT),$role]); }
 catch(PDOException $e){ if($e->getCode()==='23000') reply(['error'=>'Email or ID already registered'],409);throw $e; }
 reply(['ok'=>true],201);
}
if($action==='login'){
 $id=requiredString($d,'mnsuId');$pw=(string)($d['password']??'');$role=requiredString($d,'role');
 $s=db()->prepare('SELECT id,full_name,email,mnsu_id,password_hash,role FROM users WHERE mnsu_id=?');$s->execute([$id]);$row=$s->fetch();
 if(!$row || !password_verify($pw,$row['password_hash']) || $row['role']!==$role) reply(['error'=>'Invalid ID, password, or role'],401);
 session_regenerate_id(true);
 $_SESSION['user']=['id'=>(int)$row['id'],'name'=>$row['full_name'],'email'=>$row['email'],'role'=>$row['role']];
 $_SESSION['csrf']=bin2hex(random_bytes(32));
 reply(['user'=>$_SESSION['user'],'csrf'=>$_SESSION['csrf']]);
}
reply(['error'=>'Unknown action'],404);
