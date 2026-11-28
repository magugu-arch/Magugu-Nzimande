/**
 * Runs in <head> before anything else (inline, so it needs no download).
 *
 * 1. Adds `js` to <html>: scroll reveals are opt-in, so content stays visible
 *    without JavaScript.
 * 2. Holds early form submissions. A tap on "Sign in", "Join" or "Send" that
 *    lands before React has taken over the form would post the page the
 *    old-fashioned way. With prerendered pages, Next 16 answers that post with
 *    only part of the page, so the visitor sees a blank screen. Instead the
 *    submission is held and replayed the moment the form is live (usually well
 *    under a second). The form counts as live once React has committed the
 *    page (HydrationSignal sets `__stReady`) and has claimed the form itself
 *    (React marks DOM nodes it hydrates with `__reactProps$…` keys).
 *    Forms posting to another site (PayFast) are never touched. If the page's
 *    JavaScript never arrives, the form is submitted normally after 8 seconds.
 */
export const bootScript = `(function(){
var d=document;d.documentElement.classList.add('js');
function live(f){var k=Object.keys(f);for(var i=0;i<k.length;i++){if(k[i].indexOf('__reactProps$')===0||k[i].indexOf('__reactFiber$')===0)return true}return false}
d.addEventListener('submit',function(e){
var f=e.target;if(!(f instanceof HTMLFormElement)||(window.__stReady&&live(f)))return;
try{if(new URL(f.action,location.href).origin!==location.origin)return}catch(_){return}
e.preventDefault();var s=e.submitter,t=0;
(function retry(){
if(window.__stReady&&live(f)){setTimeout(function(){if(f.isConnected)f.requestSubmit(s&&s.form===f?s:undefined)},50);return}
if(++t<80){setTimeout(retry,100)}else{HTMLFormElement.prototype.submit.call(f)}
})();
},true);
})();`;
