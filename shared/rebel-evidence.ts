export type RebelResponseEvidence = {
  basis: string[];
  assumptions: string[];
  limitations: string[];
};

export function buildRebelResponseEvidence(input: {
  temporary: boolean;
  memoryEnabled: boolean;
  memoryTitles: string[];
  projectName?: string;
}): RebelResponseEvidence {
  const basis: string[] = ["طلبك في هذه المحادثة"];
  const assumptions: string[] = ["يُفترض أن التفاصيل التي كتبتها دقيقة وكاملة بالقدر الكافي للطلب."];
  const limitations: string[] = ["لم يُجرَ بحث ويب أو تحقق خارجي ضمن هذا الرد؛ راجع المصادر قبل اتخاذ قرار مهم."];

  if (input.projectName) basis.push(`المشروع النشط: ${input.projectName}`);
  if (input.memoryTitles.length) {
    basis.push(`ذكريات مرتبطة: ${input.memoryTitles.slice(0, 3).join("، ")}`);
  } else if (input.temporary) {
    limitations.unshift("هذه محادثة مؤقتة؛ لم تُستخدم أي ذاكرة محفوظة.");
  } else if (input.memoryEnabled) {
    limitations.unshift("لا توجد ذاكرة محفوظة مطابقة مباشرة لهذا الطلب.");
  } else {
    limitations.unshift("الذاكرة السحابية متوقفة في إعداداتك لهذا الرد.");
  }

  if (!input.projectName && !input.memoryTitles.length) {
    assumptions.push("لا توجد تفاصيل مشروع أو ذاكرة مطابقة استند إليها الرد؛ أضف سياقاً إن أردت تحليلاً أدق.");
  }

  return { basis, assumptions, limitations };
}
