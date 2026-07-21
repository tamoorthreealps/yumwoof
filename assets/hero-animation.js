document.addEventListener("DOMContentLoaded", () => {

    if (!document.querySelector(".hero-banner")) return;

    gsap.registerPlugin(ScrollTrigger);

    const split = new SplitType(".hero-banner__heading", {
        types: "words"
    });

    const tl = gsap.timeline();

    tl.from(".hero-banner__image",{
        scale:1.15,
        duration:3,
        ease:"power2.out"
    })

    .from(split.words,{
        y:120,
        opacity:0,
        stagger:.08,
        duration:1,
        ease:"power4.out"
    },"-=2.3")

    .from(".hero-banner__subheading",{
        y:40,
        opacity:0,
        filter:"blur(10px)",
        duration:.8
    },"-=.6")

    .from(".hero-banner__cta-wrap",{
        scale:.7,
        opacity:0,
        duration:.8,
        ease:"elastic.out(1,0.6)"
    },"-=.4");

});


gsap.from(".fp__title",{
    y:80,
    opacity:0,
    stagger:.15,
    scrollTrigger:{
        trigger:".fp",
        start:"top 75%"
    }
});

gsap.from(".fp__media",{
    y:120,
    opacity:0,
    stagger:.15,
    delay:.2,
    scrollTrigger:{
        trigger:".fp",
        start:"top 75%"
    }
});

gsap.from(".fp__desc",{
    y:60,
    opacity:0,
    stagger:.15,
    delay:.4,
    scrollTrigger:{
        trigger:".fp",
        start:"top 75%"
    }
});

gsap.from(".fp__shop",{
    scale:.4,
    opacity:0,
    stagger:.15,
    delay:.6,
    ease:"elastic.out(1,.5)",
    scrollTrigger:{
        trigger:".fp",
        start:"top 75%"
    }
});
