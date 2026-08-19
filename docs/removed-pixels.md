# Removed pixels (perf test) — how to restore

Disabled on branch `perf-test-no-pixels` (off latest `main-with-optimization`) to measure PageSpeed without the theme's pixels.
Each is wrapped in `{% comment %}...{% endcomment %}` in `layout/theme.liquid`, marked `REMOVED-PIXEL (<name>)`.
**Restore:** delete the two comment wrappers around a block, or revert the commit.

CANNOT be removed from the theme (load via Shopify app-embeds in `content_for_header`): Amplitude, Gorgias, Klaviyo, Attentive, TikTok, any GTM app-embed — disable in **Apps** / **Settings → Customer events**.
Left in place (app features, not tracking pixels): `replo-head`, `avada-joy`, `opinew_head`.

## TriplePixel

```liquid
<script>
      /* >> TriplePixel :: start*/
      (window.TriplePixelData = {
        TripleName: 'yumwoof.myshopify.com',
        ver: '2.12',
        plat: 'SHOPIFY',
        isHeadless: false,
      }),
        (function (W, H, A, L, E, _, B, N) {
          function O(U, T, P, H, R) {
            void 0 === R && (R = !1),
              (H = new XMLHttpRequest()),
              P ? (H.open('POST', U, !0), H.setRequestHeader('Content-Type', 'text/plain')) : H.open('GET', U, !0),
              H.send(JSON.stringify(P || {})),
              (H.onreadystatechange = function () {
                4 === H.readyState && 200 === H.status
                  ? ((R = H.responseText), U.includes('.txt') ? eval(R) : P || (N[B] = R))
                  : (299 < H.status || H.status < 200) && T && !R && ((R = !0), O(U, T - 1, P));
              });
          }
          if (((N = window), !N[H + 'sn'])) {
            (N[H + 'sn'] = 1),
              (L = function () {
                return Date.now().toString(36) + '_' + Math.random().toString(36);
              });
            try {
              A.setItem(H, 1 + (0 | A.getItem(H) || 0)),
                (E = JSON.parse(A.getItem(H + 'U') || '[]')).push({
                  u: location.href,
                  r: document.referrer,
                  t: Date.now(),
                  id: L(),
                }),
                A.setItem(H + 'U', JSON.stringify(E));
            } catch (e) {}
            var i, m, p;
            A.getItem('"!nC`') ||
              ((_ = A),
              (A = N),
              A[H] ||
                ((E = A[H] =
                  function (t, e, a) {
                    return (
                      void 0 === a && (a = []),
                      'State' == t ? E.s : ((W = L()), (E._q = E._q || []).push([W, t, e].concat(a)), W)
                    );
                  }),
                (E.s = 'Installed'),
                (E._q = []),
                (E.ch = W),
                (B = 'configSecurityConfModel'),
                (N[B] = 1),
                O('https://conf.config-security.com/model', 5),
                (i = L()),
                (m = A[atob('c2NyZWVu')]),
                _.setItem('di_pmt_wt', i),
                (p = {
                  id: i,
                  action: 'profile',
                  avatar: _.getItem('auth-security_rand_salt_'),
                  time: m[atob('d2lkdGg=')] + ':' + m[atob('aGVpZ2h0')],
                  host: A.TriplePixelData.TripleName,
                  plat: A.TriplePixelData.plat,
                  url: window.location.href,
                  ref: document.referrer,
                  ver: A.TriplePixelData.ver,
                }),
                O('https://api.config-security.com/event', 5, p),
                O('https://whale.camera/live/dot.txt', 5)));
          }
        })('', 'TriplePixel', localStorage);
      /* << TriplePixel :: end*/
    </script>
```

## TriplePixel

```liquid
<script>
      /* >> TriplePixel :: start*/
      ~(function (W, H, A, L, E, _, B, N) {
        function O(U, T, H, R) {
          void 0 === R && (R = !1),
            (H = new XMLHttpRequest()),
            H.open('GET', U, !0),
            H.send(null),
            (H.onreadystatechange = function () {
              4 === H.readyState && 200 === H.status
                ? ((R = H.responseText), U.includes('.txt') ? eval(R) : (N[B] = R))
                : (299 < H.status || H.status < 200) && T && !R && ((R = !0), O(U, T - 1));
            });
        }
        if (((N = window), !N[H + 'sn'])) {
          N[H + 'sn'] = 1;
          try {
            A.setItem(H, 1 + (0 | A.getItem(H) || 0)),
              (E = JSON.parse(A.getItem(H + 'U') || '[]')).push(location.href),
              A.setItem(H + 'U', JSON.stringify(E));
          } catch (e) {}
          A.getItem('"!nC`') ||
            ((A = N),
            A[H] ||
              ((L = function () {
                return Date.now().toString(36) + '_' + Math.random().toString(36);
              }),
              (E = A[H] =
                function (t, e) {
                  return (W = L()), (E._q = E._q || []).push([W, t, e]), W;
                }),
              (E.ch = W),
              (B = 'configSecurityConfModel'),
              (N[B] = 1),
              O('//conf.config-security.com/model', 0),
              O('//triplewhale-pixel.web.app/triplefw.txt?', 5)));
        }
      })('', 'TriplePixel', localStorage);
      /* << TriplePixel :: end*/
    </script>
```

## gsf-conversion-pixels

```liquid
{% render 'gsf-conversion-pixels' %}
```

## GTM-loader

```liquid
<!-- Google Tag Manager -->
    <script>
      (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
        var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s),
          dl = l != 'dataLayer' ? '&l=' + l : '';
        j.async = true;
        j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
        f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'dataLayer', 'GTM-TR3RM44');
    </script>
    <!-- End Google Tag Manager -->
```

## GTM-noscript

```liquid
<noscript
      ><iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-TR3RM44"
        height="0"
        width="0"
        style="display:none;visibility:hidden"
      ></iframe
    ></noscript>
```

## Customers.ai

```liquid
<!-- Customers.ai Pixel -->
    <script async="async" src="https://mm-uxrv.com/js/mm_1d4ef5e1-1d66-4a2d-ad37-aa0e33537fc5-35044943.js"></script>
```

## AddShoppers

```liquid
<!-- AddShoppers / shop.pe (CPG Pixel) -->
    <script type="text/javascript">
      var AddShoppersWidgetOptions = { loadCss: false, pushResponse: false };
      !(function () {
        var t = document.createElement('script');
        (t.type = 'text/javascript'),
          (t.async = !0),
          (t.id = 'AddShoppers'),
          (t.src = 'https://shop.pe/widget/widget_async.js#658153ee3ef6663bfe5b2cff'),
          document.getElementsByTagName('head')[0].appendChild(t);
      })();
    </script>
```

## OpenAI-ads

```liquid
<!-- OpenAI ads pixel -->
    <script>
      !(function (w, d, s, u) {
        if (w.oaiq) return;
        var q = function () {
          q.q.push(arguments);
        };
        q.q = [];
        w.oaiq = q;
        var j = d.createElement(s);
        j.async = 1;
        j.src = u;
        var f = d.getElementsByTagName(s)[0];
        f.parentNode.insertBefore(j, f);
      })(window, document, 'script', 'https://cdn.openai.com/ads/oaiq.js');
      oaiq('init', 'TeQ6wbNgBfSLAUECcnegb2');
      oaiq('track', 'page_viewed');
    </script>
```

