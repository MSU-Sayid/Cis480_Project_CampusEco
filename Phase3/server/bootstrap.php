<?php
declare(strict_types=1);
ini_set('display_errors','0');
ini_set('session.use_strict_mode','1');
if (PHP_SAPI !== 'cli') {
 session_set_cookie_params(['httponly'=>true,'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off','samesite'=>'Lax','path'=>'/']);
}
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function reply(array $data,int $code=200): never { http_response_code($code); echo json_encode($data,JSON_UNESCAPED_SLASHES); exit; }
function db(): PDO {
 static $pdo=null;
 if ($pdo) return $pdo;
 $c=require __DIR__.'/config.php';
 try {
  $pdo=new PDO('mysql:host='.$c['host'].';port='.$c['port'].';dbname='.$c['database'].';charset=utf8mb4',
   $c['username'],$c['password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,PDO::ATTR_EMULATE_PREPARES=>false]);
 } catch(Throwable $e){ reply(['error'=>'Database connection unavailable. Check README setup.'],503); }
 return $pdo;
}
function data(): array { $raw=file_get_contents('php://input'); $d=json_decode($raw ?: '{}',true); if(!is_array($d)) reply(['error'=>'Invalid JSON'],400); return $d; }
function user(?string $role=null): array {
 if(empty($_SESSION['user'])) reply(['error'=>'Please sign in'],401);
 $u=$_SESSION['user'];
 if($role!==null && $u['role']!==$role) reply(['error'=>'Forbidden for this role'],403);
 return $u;
}
function csrf(): void {
 $token=$_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
 if(!is_string($token) || !hash_equals($_SESSION['csrf'] ?? '',$token)) reply(['error'=>'Invalid CSRF token; refresh and sign in again'],403);
}
function method(string $required): void { if($_SERVER['REQUEST_METHOD']!==$required) reply(['error'=>'Method not allowed'],405); }
function validTracking(string $s): bool {return (bool)preg_match('/^MNSU-[0-9]{6}$/',$s);}
function requiredString(array $d,string $key): string {return trim((string)($d[$key]??''));}
