document.addEventListener("DOMContentLoaded", () => {

    gsap.registerPlugin(ScrollTrigger);

    /* ==========================
       HERO BANNER
    ========================== */

    const hero = document.querySelector(".hero-banner");

    if (hero) {

        const split = new SplitType(".hero-banner__heading", {
            types: "words"
        });

const tl = gsap.timeline();

tl.fromTo(
    split.words,
    {
        y: 120,
        opacity: 0
    },
    {
        y: 0,
        opacity: 1,
        stagger: 0.08,
        duration: 1,
        ease: "power4.out"
    }
)

.fromTo(
    ".hero-banner__subheading",
    {
        y: 40,
        opacity: 0,
        filter: "blur(10px)"
    },
    {
        y: 0,
        opacity: 1,
        filter: "blur(0px)",
        duration: .8
    },
    "-=.6"
)

.fromTo(
    ".hero-banner__cta-wrap",
    {
        y: 40,
        opacity: 0,
        scale: .7
    },
    {
        y: 0,
        opacity: 1,
        scale: 1,
        duration: .8,
        ease: "elastic.out(1,0.6)"
    },
    "-=.4"
);

    }


    /* ==========================
       FEATURED PRODUCTS
    ========================== */

    const fp = document.querySelector(".fp");

    if (fp) {

gsap.fromTo(
    ".fp__heading",
    {
        y: 80,
        opacity: 0
    },
    {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power4.out",
        scrollTrigger: {
            trigger: ".fp",
            start: "top 75%",
            once: true
        }
    }
);

gsap.fromTo(
    ".fp__card",
    {
        y: 120,
        opacity: 0
    },
    {
        y: 0,
        opacity: 1,
        stagger: 0.18,
        duration: 1,
        ease: "power4.out",
        scrollTrigger: {
            trigger: ".fp",
            start: "top 70%",
            once: true
        }
    }
);
    }

});