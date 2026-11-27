/* Parallax otimizado: requestAnimationFrame + entrada suave das seções. */
(() => {
  const hero=document.querySelector(".legion-home .premium-home-hero");
  if(!hero || !window.matchMedia)return;
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)");
  const mobile=window.matchMedia("(max-width: 760px)");
  const revealTargets=document.querySelectorAll(
    ".legion-home .home-section-heading, .legion-home .home-benefit-card, "+
    ".legion-home .home-course-preview, .legion-home .home-course-info, "+
    ".legion-home .home-step-card, .legion-home .home-how-section .home-step, "+
    ".legion-home .home-final-cta > *"
  );
  let observer=null,raf=0;

  function resetHero(){
    hero.style.setProperty("--la-parallax-image","0px");
    hero.style.setProperty("--la-parallax-copy","0px");
    hero.style.setProperty("--la-parallax-card","0px");
  }
  function applyScroll(){
    raf=0;
    if(reduce.matches){resetHero();return;}
    const scroll=Math.max(0,Math.min(window.scrollY||0,hero.offsetHeight));
    // O fundo move ligeiramente mais devagar que o conteúdo.
    const mobileMode=mobile.matches;
    const imageShift=Math.round(Math.min(mobileMode?28:65,scroll*(mobileMode?.055:.11)));
    const textShift=Math.round(Math.min(mobileMode?9:30,scroll*(mobileMode?.018:.055)));
    const cardShift=Math.round(Math.min(mobileMode?5:20,scroll*(mobileMode?.012:.035)));
    hero.style.setProperty("--la-parallax-image",imageShift+"px");
    hero.style.setProperty("--la-parallax-copy",textShift+"px");
    hero.style.setProperty("--la-parallax-card",-cardShift+"px");
  }
  function scheduleScroll(){
    if(!raf)raf=requestAnimationFrame(applyScroll);
  }

  if("IntersectionObserver" in window && !reduce.matches){
    observer=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(entry.isIntersecting){
          entry.target.classList.add("la-reveal-visible");
          observer.unobserve(entry.target);
        }
      }
    },{rootMargin:"0px 0px -35px 0px",threshold:.08});
    for(const target of revealTargets){
      target.classList.add("la-reveal-ready");
      observer.observe(target);
    }
  }
  function onMotionChange(){
    if(reduce.matches){
      resetHero();
      observer?.disconnect();
      revealTargets.forEach(node=>{
        node.classList.remove("la-reveal-ready");
        node.classList.add("la-reveal-visible");
      });
    }else scheduleScroll();
  }
  if(reduce.addEventListener)reduce.addEventListener("change",onMotionChange);
  window.addEventListener("scroll",scheduleScroll,{passive:true});
  window.addEventListener("resize",scheduleScroll,{passive:true});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleScroll();});
  scheduleScroll();
})();
