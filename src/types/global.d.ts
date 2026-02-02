declare module 'jspdf' {
  import jsPDF from 'jspdf/dist/jspdf.min.js'
  export default jsPDF
}

declare module 'jspdf-autotable' {
  const autoTable: (doc: any, options: any) => void
  export default autoTable
}