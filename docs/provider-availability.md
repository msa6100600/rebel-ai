# التحقق التشغيلي من موفّرات Rebel AI

تاريخ التحقق: 18 أغسطس 2026.

أظهر اختبار الاتصال الفعلي أن `gemini-2.5-flash` يرفض الاستخدام للمفاتيح الجديدة برسالة من Google توصي بـ `gemini-3.6-flash`، وأن `llama-3.3-70b-versatile` غير متاح لمفتاح Groq الحالي. تم التحقق من أن `gemini-3.6-flash` و`qwen/qwen3.6-27b` و`mistral-small-latest` تستجيب فعلياً.

يؤكد [دليل Groq الرسمي](https://console.groq.com/docs/reasoning) أن `qwen/qwen3.6-27b` يدعم `reasoning_effort: "none"` لتعطيل رموز التفكير، و`reasoning_format: "hidden"` لعرض الإجابة النهائية فقط. يجب إرسال إحدى الطريقتين فقط في طلبات Groq.
