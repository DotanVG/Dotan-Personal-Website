"use client";

import Script from "next/script";
import { site } from "@/content/site";

export function AnalyticsProvider() {
  const gaId = site.services.gaId;
  const proveSourceApiKey = site.services.proveSourceApiKey;
  const proveSourceVersion = site.services.proveSourceVersion;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
      {proveSourceApiKey ? (
        <Script id="provesrc" strategy="afterInteractive">
          {`
            if (!window.provesrc) {
              !function(o,i){provesrc=window.provesrc={dq:[],display:function(){this.dq.push(arguments)}},o._provesrcAsyncInit=function(){provesrc.init({apiKey:"${proveSourceApiKey}",v:"${proveSourceVersion}"})};var r=i.createElement("script");r.type="text/javascript",r.async=!0,r["ch"+"ar"+"set"]="UTF-8",r.src="https://cdn.provesrc.com/provesrc.js";var e=i.getElementsByTagName("script")[0];e.parentNode.insertBefore(r,e)}(window,document);
            }
          `}
        </Script>
      ) : null}
    </>
  );
}
