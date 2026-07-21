document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);

    /* ==========================
       HERO
    ========================== */

const hero = document.querySelector(".hero-banner");

if (hero) {

    const split = new SplitType(".hero-banner__heading", {
        types: "words"
    });

    const tl = gsap.timeline();

    if (document.querySelector(".hero-banner__image")) {
        tl.from(".hero-banner__image", {
            scale: 1.15,
            duration: 3,
            ease: "power2.out"
        });
    }

    tl.from(split.words, {
        y: 120,
        opacity: 0,
        stagger: 0.08,
        duration: 1,
        ease: "power4.out"
    })

    .from(".hero-banner__subheading", {
        y: 40,
        opacity: 0,
        filter: "blur(10px)",
        duration: .8
    }, "-=.6")

    .from(".hero-banner__cta-wrap", {
        scale: .7,
        opacity: 0,
        duration: .8,
        ease: "elastic.out(1,0.6)"
    }, "-=.4");

}

    /* ==========================
       FEATURED PRODUCTS
    ========================== */

    const fp = document.querySelector(".fp");

    if (fp) {

        const fpTl = gsap.timeline({
            scrollTrigger: {
                trigger: fp,
                start: "top 75%",
                toggleActions: "play none none none"
            }
        });

        fpTl
        .fromTo(".fp__heading",
    {
        clipPath: "inset(0 100% 0 0)"
    },
    {
        clipPath: "inset(0 0% 0 0)",
        duration: 5.8,
        ease: "power4.out"
    }
)

        .from(".fp__title", {
            y: 50,
            opacity: 0,
            stagger: .15,
            duration: .6
        }, "-=.4")

        .from(".fp__labels", {
            y: 30,
            opacity: 0,
            stagger: .15,
            duration: .5
        }, "-=.4")

        .from(".fp__media", {
            scale: .8,
            opacity: 0,
            stagger: .15,
            duration: .8
        }, "-=.3")

        .from(".fp__desc", {
            y: 30,
            opacity: 0,
            stagger: .15,
            duration: .5
        }, "-=.4")

        .from(".fp__recipes", {
            y: 20,
            opacity: 0,
            stagger: .15,
            duration: .4
        }, "-=.3")

        .from(".fp__shop", {
            scale: .4,
            opacity: 0,
            stagger: .15,
            duration: .8,
            ease: "elastic.out(1,.5)"
        }, "-=.3");

    }

});