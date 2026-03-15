from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import fitz


@dataclass(frozen=True)
class FigureEntry:
    caption: str
    functionality: str


FIGURES: list[FigureEntry] = [
    FigureEntry(
        caption="Figure 1: Admin Dashboard",
        functionality=(
            "The Admin Dashboard gives administrators a consolidated view of key platform metrics, recent activity, and operational shortcuts so they can quickly monitor usage, identify pending work, and navigate to the areas that need attention."
        ),
    ),
    FigureEntry(
        caption="Figure 2: Admin - Account Verification",
        functionality=(
            "The account verification screen lists users awaiting review and lets administrators validate submitted registration details before granting access, which helps keep platform membership accurate, secure, and aligned with approved roles."
        ),
    ),
    FigureEntry(
        caption="Figure 2.1: Admin - Verifying an account",
        functionality=(
            "This verification flow lets an administrator inspect an individual account request, confirm the user information and supporting details, and then approve or reject the request so the account moves to the correct access state."
        ),
    ),
    FigureEntry(
        caption="Figure 3: Admin - User Management",
        functionality=(
            "The user management page allows administrators to browse, search, filter, and maintain user records so they can monitor account status, review assigned roles, and open specific actions for each user from one control surface."
        ),
    ),
    FigureEntry(
        caption="Figure 3.1: Admin - Creating a user",
        functionality=(
            "The user creation form enables administrators to add new platform accounts by entering core profile information, assigning the appropriate role, and preparing the account for activation without waiting for self-registration."
        ),
    ),
    FigureEntry(
        caption="Figure 3.2: Admin - Role Management",
        functionality=(
            "The role management view is used to define and maintain system roles so administrators can control which permission sets are available and keep access responsibilities consistent across the platform."
        ),
    ),
    FigureEntry(
        caption="Figure 3.3: Admin - Viewing Role Permission",
        functionality=(
            "This permission view shows the access capabilities attached to a selected role, giving administrators a clear reference for what that role can do before they assign it to users or adjust related governance rules."
        ),
    ),
    FigureEntry(
        caption="Figure 3.4: Admin - Editing a User Basic Information",
        functionality=(
            "The basic information editor lets administrators update an existing user's profile details, such as identifying and contact information, without recreating the account or affecting unrelated learning records."
        ),
    ),
    FigureEntry(
        caption="Figure 3.5: Admin - Changing a User Role",
        functionality=(
            "The role change action allows administrators to reassign a user's access level when responsibilities change, ensuring the user immediately receives the correct permissions and system visibility for the new role."
        ),
    ),
    FigureEntry(
        caption="Figure 4: Admin & Trainer - Course Management",
        functionality=(
            "The course management area is used by administrators and trainers to maintain the course catalog, update metadata, control publication state, and manage the high-level structure that connects courses to modules and assessments."
        ),
    ),
    FigureEntry(
        caption="Figure 4.1: Admin & Trainer - Course Creation Modal",
        functionality=(
            "The course creation modal supports the setup of a new course by collecting the essential information required to define its identity, visibility, and initial configuration before the content structure is expanded further."
        ),
    ),
    FigureEntry(
        caption="Figure 5: Admin & Trainer - Module Management",
        functionality=(
            "The module management interface organizes the modules inside a course and lets staff control sequencing, prerequisites, and maintenance actions so the learning path stays structured and easy to update."
        ),
    ),
    FigureEntry(
        caption="Figure 5.1: Admin & Trainer - Module Creation and Editing",
        functionality=(
            "This module editor is where administrators and trainers build or revise module content, define learning materials and supporting blocks, and configure the instructional details that learners interact with inside the course flow."
        ),
    ),
    FigureEntry(
        caption="Figure 5.2: Admin & Trainer - Assessment Creation and Editing",
        functionality=(
            "The assessment editor lets staff create and manage graded evaluation content by defining questions, correct answers, scoring rules, and assessment settings so learner submissions can be reviewed and reported consistently."
        ),
    ),
    FigureEntry(
        caption="Figure 6: Admin & Trainer - Taxonomy Management",
        functionality=(
            "The taxonomy management page maintains the categories, topics, and skill labels used to classify content, improve filtering, and support reporting and recommendation logic across the learning system."
        ),
    ),
    FigureEntry(
        caption="Figure 7: Admin - Enrollment Management",
        functionality=(
            "The enrollment management page enables administrators to review and manage learner enrollment records, track status and progress, and take corrective actions when access or assignment changes are required."
        ),
    ),
    FigureEntry(
        caption="Figure 7.1: Admin - Bulk Enroll Modal",
        functionality=(
            "The bulk enrollment modal streamlines course assignment by allowing administrators to enroll multiple learners in one action, which reduces repetitive work when onboarding groups or updating large training cohorts."
        ),
    ),
    FigureEntry(
        caption="Figure 8: Admin & Trainer - Viewing Learner's Progress",
        functionality=(
            "This learner progress view gives administrators and trainers a detailed snapshot of module completion, assessment activity, and overall course readiness so they can monitor performance and make approval decisions with better context."
        ),
    ),
    FigureEntry(
        caption="Figure 8.1: Admin & Trainer - Assessment Review Modal",
        functionality=(
            "The assessment review modal supports manual evaluation workflows by letting staff inspect submitted answers, assign scores or outcomes, and record feedback for assessments that require human review."
        ),
    ),
    FigureEntry(
        caption="Figure 9: Admin - Reports",
        functionality=(
            "The reports interface aggregates training data into a reporting view that helps administrators analyze enrollments, completion trends, and assessment performance for operational monitoring and decision-making."
        ),
    ),
    FigureEntry(
        caption="Figure 10: Admin, Training Officer, and Learner - Profile",
        functionality=(
            "The profile page lets each user view and maintain personal account information relevant to their platform identity, helping keep profile records current across administrative, instructional, and learner-facing workflows."
        ),
    ),
    FigureEntry(
        caption="Figure 11: Admin, Training Officer, and Learner - Settings",
        functionality=(
            "The settings page provides access to account and application preferences so users can manage configuration options such as security-related controls and personal experience settings in one place."
        ),
    ),
]


def block_text(block: dict) -> str:
    return " ".join(
        span["text"]
        for line in block.get("lines", [])
        for span in line.get("spans", [])
        if span.get("text")
    ).strip()


def wrap_text(text: str, width: float, font_name: str, font_size: float) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if fitz.get_text_length(candidate, fontname=font_name, fontsize=font_size) <= width:
            current = candidate
            continue
        if current:
            lines.append(current)
        current = word

    if current:
        lines.append(current)

    return lines


def draw_paragraph(page: fitz.Page, x: float, y: float, width: float, text: str) -> float:
    font_name = "helv"
    font_size = 10.5
    line_height = font_size * 1.35
    for line in wrap_text(text, width, font_name, font_size):
        page.insert_text((x, y), line, fontname=font_name, fontsize=font_size, color=(0, 0, 0))
        y += line_height
    return y


def collect_caption_blocks(doc: fitz.Document) -> list[dict]:
    caption_blocks: list[dict] = []
    for page_index, page in enumerate(doc):
        for block in page.get_text("dict").get("blocks", []):
            if block.get("type") != 0:
                continue
            text = block_text(block)
            if not text.startswith("Figure "):
                continue
            caption_blocks.append(
                {
                    "page_index": page_index,
                    "bbox": fitz.Rect(block["bbox"]),
                    "text": text,
                }
            )
    return caption_blocks


def main() -> None:
    source = Path(r"c:\Users\caran\Downloads\Untitled_1.pdf")
    output = Path(r"c:\Users\caran\Desktop\peso-system\peso-academy\temp_markdowns\Untitled_1_revised.pdf")

    doc = fitz.open(source)
    caption_blocks = collect_caption_blocks(doc)

    if len(caption_blocks) != len(FIGURES):
        raise RuntimeError(f"Expected {len(FIGURES)} figure captions, found {len(caption_blocks)}")

    figures_by_page: dict[int, list[dict]] = defaultdict(list)
    for block, figure in zip(caption_blocks, FIGURES, strict=True):
        figures_by_page[block["page_index"]].append(
            {
                "bbox": block["bbox"],
                "caption": figure.caption,
                "functionality": f"{figure.caption} functionality: {figure.functionality}",
            }
        )

    for page_index, page_figures in figures_by_page.items():
        page = doc[page_index]
        for figure in page_figures:
            rect = fitz.Rect(figure["bbox"])
            page.add_redact_annot(
                fitz.Rect(rect.x0 - 3, rect.y0 - 2, rect.x1 + 6, rect.y1 + 2),
                fill=(1, 1, 1),
            )
        page.apply_redactions()

    revised = fitz.open()

    for page_index, page in enumerate(doc):
        page_figures = figures_by_page.get(page_index, [])
        paragraph_width = page.rect.width - 144
        line_height = 10.5 * 1.35
        extra_height = 28

        for figure in page_figures:
            line_count = len(wrap_text(figure["functionality"], paragraph_width, "helv", 10.5))
            extra_height += (line_count * line_height) + 18

        new_page = revised.new_page(width=page.rect.width, height=page.rect.height + extra_height)
        new_page.show_pdf_page(fitz.Rect(0, 0, page.rect.width, page.rect.height), doc, page_index)

        for figure in page_figures:
            rect = fitz.Rect(figure["bbox"])
            new_page.insert_text(
                (rect.x0, rect.y1 - 2),
                figure["caption"],
                fontname="helv",
                fontsize=11,
                color=(0, 0, 0),
            )

        y = page.rect.height + 18
        new_page.draw_line(
            fitz.Point(72, page.rect.height + 8),
            fitz.Point(page.rect.width - 72, page.rect.height + 8),
            color=(0.7, 0.7, 0.7),
            width=0.8,
        )

        for figure in page_figures:
            y = draw_paragraph(new_page, 72, y, paragraph_width, figure["functionality"])
            y += 10

    revised.save(output, garbage=4, deflate=True)
    print(f"Created revised PDF: {output}")


if __name__ == "__main__":
    main()