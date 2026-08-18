# موفّرات النماذج المجانية في Rebel AI

يستخدم التطبيق موفّرات خارجية تتطلب مفاتيح API من حساب المالك، مع تفعيل الخطط المجانية فقط وعدم إضافة معلومات فوترة أو نماذج مدفوعة في الإعدادات.

| الموفّر | النموذج المستهدف | سلوك الحد |
|---|---|---|
| Google AI Studio | `gemini-2.5-flash` | إظهار رسالة عند خطأ `429 RESOURCE_EXHAUSTED` والانتظار قبل إعادة المحاولة. |
| Groq | `llama-3.3-70b-versatile` | قراءة ترويسات حدود الاستخدام عند توفرها، وإظهار مدة `retry-after` عند 429. |
| Mistral | `mistral-small-latest` | إظهار رسالة عند حد الخطة أو حد السرعة، مع منع المحاولة التلقائية المتكررة. |

تشير وثائق Google إلى أن الطبقة المجانية تقدم وصولاً محدوداً للنماذج وأن تجاوز أي حد للطلبات أو الرموز يولد خطأ حد استخدام. تشير وثائق Groq إلى `429 Too Many Requests` وترويسة `retry-after` عند تجاوز الحد. تشير وثائق Mistral إلى أن الوضع المجاني يوفر استخداماً شهرياً مشمولاً ضمن الحدود الظاهرة في صفحة Limits.

## المصادر الرسمية

- https://ai.google.dev/gemini-api/docs/pricing
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://console.groq.com/docs/rate-limits
- https://docs.mistral.ai/admin/billing-usage/usage-limits
