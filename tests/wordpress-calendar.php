<?php
// Isolated plugin bootstrap contract; no WordPress database is used.
define('ABSPATH', __DIR__ . '/');
$actions=[];$settings=['mphb_ical_auto_sync_enable'=>1,'mphb_ical_auto_sync_interval'=>'vc_five_minutes'];$scheduled=false;$reschedules=0;
function add_action($name,$callback,...$args){$GLOBALS['actions'][$name][]=$callback;}
function add_filter(...$args){}
function get_option($key){return $GLOBALS['settings'][$key]??false;}
function wp_next_scheduled($hook){return $GLOBALS['scheduled'];}
function MPHB(){return new class {public function cronManager(){return new class {public function rescheduleAutoSynchronizationCrons(){$GLOBALS['reschedules']++;}};}};}
function check($pass,$description){if(!$pass){fwrite(STDERR,"FAIL: $description\n");exit(1);}echo "PASS: $description\n";}
require $argv[1];
check(isset($actions['plugins_loaded']),'calendar recovery waits until all plugins have registered intervals');
$callback=$actions['plugins_loaded'][0];call_user_func($callback);
check($reschedules===1,'missing custom calendar event invokes vendor scheduler');
$scheduled=time()+300;call_user_func($callback);
check($reschedules===1,'existing event keeps its timestamp');
$scheduled=false;$settings['mphb_ical_auto_sync_enable']=0;call_user_func($callback);
check($reschedules===1,'disabled calendar synchronization stays disabled');
$settings['mphb_ical_auto_sync_enable']=1;$settings['mphb_ical_auto_sync_interval']='daily';call_user_func($callback);
check($reschedules===1,'other intervals remain under vendor control');
