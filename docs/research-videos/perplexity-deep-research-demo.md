Starting video analysis...
Submitting video analysis task...
Task submitted (ID: video-analysis-397971ce-9e6f-445e-b9d9-870a271f33ed)
[8s] Status: Analyzing video content with AI...
[30s] Status: Analysis completed
[30s] Analysis completed!
Full analysis result saved to: /home/ubuntu/video_UobQwGTli5w_analysis_20260823_185702.md
Note: This tool performs AI-based visual and audio analysis, not verbatim transcription. For detailed speech transcription, use `manus-speech-to-text` instead.
Analysis result:

Based on the visual and audio analysis of the video, here is the detailed extraction regarding the practical workflow of Perplexity Deep Research.

### (A) Speaker and Demo Context
The video features **Andy Stapleton**, an academic content creator and researcher. He demonstrates the **Perplexity Deep Research** interface on a desktop browser. The context is specifically focused on how students and academics can use the tool to automate literature reviews and research paper introductions, comparing its utility to ChatGPT.

### (B) Near-Exact Quotes
1. "Perplexity has been an academic powerhouse because it is able to look specifically for academic sources."
2. "You get access to OpenAI, Reasoning with R1, Deep Research, and Pro Search, and you get four enhanced queries remaining today... which means there's five a day max."
3. "This is probably a bit of a game-changer for students just because it's free."
4. "Another thing that I want you to do if you use this for academic research is this bit: set sources for search... don't use web."
5. "Deep research often takes a few minutes to complete. I’ll start by preparing a research plan."
6. "It went through all of these stages and I love that you can go in and just expand to see what it did."
7. "Unlike ChatGPT where they highlight what they’ve actually referenced, it just takes you to that page."
8. "It doesn't do a short deep; it only does big and deep."

### (C) Research and Workflow Details
*   **Research Planning:** Upon receiving a prompt, the AI does not answer immediately. It displays a "Deep Research" status box that states it is "preparing a research plan." It then lists sequential steps it is taking, such as "conducting a search for literature reviews" and "searching specifically for fabrication methods."
*   **Source Selection:** The UI includes a "Set sources for search" toggle. The observed options are **Web** (entire internet), **Academic** (scholarly and research papers), and **Social** (discussions and opinions). The speaker explicitly recommends disabling "Web" for academic tasks.
*   **Citations:** The tool generates a list of sources (e.g., "58 sources") at the top of the answer. In-text citations appear as numbered superscripts. Clicking a citation opens a side panel or a new tab directly to the source's hosting site (e.g., PubMed, Semantic Scholar).
*   **File Handling & Export:** The interface provides an "Export" button with three options:
    *   **PDF:** A standard document format.
    *   **Markdown:** For use in text editors or note-taking apps.
    *   **Perplexity Page:** A dedicated web layout.
*   **Sharing Workflow:** The "Perplexity Page" creates a formatted, public-facing URL. This page includes a table of contents, embedded images/videos (if applicable), and a sectioned bibliography where references are grouped by the topic they support.

### (D) Limitations, Costs, and Caveats
*   **Daily Quota:** Free users are limited to **5 enhanced queries per day** (shared between Pro Search and Deep Research).
*   **Processing Time:** The speaker notes that Deep Research "takes a few minutes to complete," making it significantly slower than standard LLM responses.
*   **Citation Failure on Short Prompts:** When the speaker prompted for a "short 300-word intro," the Deep Research mode provided the text but **failed to include any citations**, despite the prompt explicitly requesting them.
*   **Auditability Gap:** The speaker observes that Perplexity links to the source page but does not highlight the specific text within the source that supports the claim, a feature he notes is present in ChatGPT’s research mode.
*   **Reliability:** The speaker suggests the tool is "big and deep" only; it struggles to maintain academic rigor (citations) when forced into a concise format.

### (E) Auditability vs. Fluency Assessment
*   **Fluency:** The tool is highly fluent, producing sectioned reports with professional headings (e.g., "Novel Fabrication Methods," "Figure of Merit Analysis").
*   **Auditability:** Perplexity prioritizes **process transparency**. By allowing users to expand the "Research Plan," the user can see the search queries the AI used to find information. However, its auditability is "coarse-grained"—it proves a source exists and is relevant to a section, but it does not provide the "fine-grained" proof of exactly which sentence in a 20-page PDF supports a specific claim.

### (F) Implementation Implications for Rebel AI
For a mobile Arabic assistant like Rebel AI, the following implementation details are suggested by this workflow:
1.  **Source Filtering:** Implement a toggle to switch between "General Web" and "Arabic Academic/Verified" sources to prevent the mixing of scholarly data with social media rumors.
2.  **Progress Indicators:** Since deep research takes minutes, Rebel AI should show a "Thinking/Searching" UI that details the steps (e.g., "Searching for Saudi economic reports...") to keep the user engaged.
3.  **Mobile-Optimized Export:** Instead of just text, provide a "Generate Research Page" feature similar to Perplexity, allowing users to share a link to a formatted report rather than a long block of chat text.
4.  **Quota Visibility:** A clear counter for "Deep Searches" is essential for managing server costs and user expectations on a mobile platform.
5.  **Citation Enforcement:** Ensure the system does not drop citations when a user asks for a summary; the "short deep" failure observed in Perplexity is a specific pain point to avoid.
