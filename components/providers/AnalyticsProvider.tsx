"use client";

import Script from "next/script";
import { useEffect } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { site } from "@/content/site";
import { initAnalytics } from "@/lib/analytics";

function redactUrl<T extends { url: string }>(event: T): T {
  const url = new URL(event.url);
  return { ...event, url: url.origin + url.pathname };
}

export function AnalyticsProvider() {
  const gaId = site.services.gaId;
  useEffect(initAnalytics, []);
  return (
    <>
      <Analytics beforeSend={redactUrl} />
      <SpeedInsights beforeSend={redactUrl} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="lazyOnload"
      />
      <Script id="provesrc" strategy="afterInteractive">
        {`
          if (!window.provesrc) {
            !function(o,i){provesrc=window.provesrc={dq:[],display:function(){this.dq.push(arguments)}},o._provesrcAsyncInit=function(){provesrc.init({apiKey:${JSON.stringify(site.services.proveSourceApiKey).replace(/</g, "\\u003c")},v:${JSON.stringify(site.services.proveSourceVersion).replace(/</g, "\\u003c")}})};var r=i.createElement("script");r.type="text/javascript",r.async=!0,r["ch"+"ar"+"set"]="UTF-8",r.src="https://cdn.provesrc.com/provesrc.js";var e=i.getElementsByTagName("script")[0];e.parentNode.insertBefore(r,e)}(window,document);
          }
        `}
      </Script>
    </>
  );
}
