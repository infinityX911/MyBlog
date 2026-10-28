"use client";

import React from "react";

interface PaginationProps {
  itemsPerPage: number;
  totalItems: number;
  paginate: (page: number) => void;
  currentPage: number;
}

const MAX_BUTTONS = 6;

export function Pagination({ itemsPerPage, totalItems, paginate, currentPage }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  const renderPageButtons = () => {
    if (pageNumbers.length <= MAX_BUTTONS) {
      return pageNumbers.map((number) => (
        <li key={number} className={number === currentPage ? "active" : ""}>
          <button onClick={() => paginate(number)}>{number}</button>
        </li>
      ));
    }

    const half = Math.floor(MAX_BUTTONS / 2);
    const visible: (number | string)[] = [];

    if (currentPage <= half) {
      for (let i = 1; i <= MAX_BUTTONS - 1; i++) visible.push(i);
      visible.push("...", totalPages);
    } else if (currentPage >= totalPages - half) {
      visible.push(1, "...");
      for (let i = totalPages - MAX_BUTTONS + 2; i <= totalPages; i++) visible.push(i);
    } else {
      visible.push(1, "...");
      for (let i = currentPage - half; i <= currentPage + half; i++) visible.push(i);
      visible.push("...", totalPages);
    }

    return visible.map((number, index) => (
      <li key={index} className={number === currentPage ? "active" : ""}>
        {number === "..." ? (
          <span>{number}</span>
        ) : (
          <button onClick={() => paginate(number as number)}>{number}</button>
        )}
      </li>
    ));
  };

  return (
    <nav>
      <ul className="p-pagination">
        <li>
          <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
            Previous
          </button>
        </li>
        {renderPageButtons()}
        <li>
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Pagination;