// =====================================================
// SISTEMA LIMA'S PIZZARIA - GOOGLE APPS SCRIPT
// =====================================================

var CONFIG = {
  PLANILHA_ID: '1QPiQTId5d904Q4hRFTiDeRSydRr3D_YhcD1xahQuFTQ',
  PASTA_COMPROVANTES_ID: '1cnnY5J_58N9rR0qd45u1XBH4ypfcFTw0',
  NUMERO_WHATSAPP: '5544997671610',
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxDI4G-ODEtByxxf_9BzfEzW5QJPQjYP4sk8tO8mOT5skWRXk_BoFNq7smRVFZ6kmMK/exec'
};

var PRODUTOS_ABA = 'Produtos';

function criarRespostaJSON(dados) {
  return ContentService
    .createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var parametros = e ? e.parameter : {};
  var acao = parametros.acao || parametros.action || '';

  if (acao === 'listarProdutos') return criarRespostaJSON(listarProdutos());
  if (acao === 'listar') return criarRespostaJSON(listarPedidosParaAdmin());
  if (acao === 'atualizarStatus' && parametros.id && parametros.status) return criarRespostaJSON(atualizarStatusPedido(parametros.id, parametros.status));
  if (acao === 'testar') return criarRespostaJSON({ success: true, message: 'Sistema online!', data: new Date().toLocaleString('pt-BR') });

  if (acao === 'salvarProduto') {
    var dadosStr = parametros.dados || '';
    var produto = {};
    try { produto = JSON.parse(dadosStr); } catch(e2) {}
    if (!produto.nome) {
      produto = {
        id: parametros.id ? parseInt(parametros.id) : 0,
        nome: parametros.nome || '',
        categoria: parametros.categoria || '',
        preco: parseFloat(parametros.preco) || 0,
        imagem: parametros.imagem || '',
        descricao: parametros.descricao || '',
        ativo: parametros.ativo !== 'false' && parametros.ativo !== 'NÃO'
      };
    }
    return criarRespostaJSON(salvarProduto(produto));
  }
  if (acao === 'deletarProduto' && parametros.id) return criarRespostaJSON(deletarProduto(parseInt(parametros.id)));

  return criarPaginaInicialWebApp();
}

function doPost(e) {
  try {
    if (!e || !e.postData) return criarRespostaJSON({ success: false, message: 'Nenhum dado recebido' });

    var dados = null;
    var contentType = e.postData.type || '';

    if (contentType.includes('application/json')) {
      try { dados = JSON.parse(e.postData.contents); } catch(err) {}
    }

    if (!dados && e.parameter) {
      if (e.parameter.dados) {
        try { dados = JSON.parse(e.parameter.dados); } catch(err) {}
      }
      if (!dados && Object.keys(e.parameter).length > 0) {
        dados = {};
        Object.keys(e.parameter).forEach(function(k) { dados[k] = e.parameter[k]; });
      }
    }

    if (!dados && e.postData && e.postData.contents) {
      try { dados = JSON.parse(e.postData.contents); } catch(err) {}
    }

    if (!dados) return criarRespostaJSON({ success: false, message: 'Dados inválidos' });

    var acao = dados.acao || dados.action || 'salvarPedido';

    if (acao === 'salvarProduto') {
      var prod = dados.produto || dados;
      return criarRespostaJSON(salvarProduto({
        id: prod.id ? parseInt(prod.id) : 0,
        nome: prod.nome || '',
        categoria: prod.categoria || '',
        preco: parseFloat(prod.preco) || 0,
        imagem: prod.imagem || prod.foto || '',
        descricao: prod.descricao || '',
        ativo: prod.ativo !== 'false' && prod.ativo !== false && prod.ativo !== 'NÃO'
      }));
    }
    if (acao === 'deletarProduto') return criarRespostaJSON(deletarProduto(parseInt(dados.id || dados.produtoId)));
    if (acao === 'listarProdutos') return criarRespostaJSON(listarProdutos());

    return criarRespostaJSON(salvarPedidoCompleto(dados));
  } catch (error) {
    return criarRespostaJSON({ success: false, message: 'Erro: ' + error.message });
  }
}

function obterOuCriarAbaProdutos() {
  var planilha = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
  var aba = planilha.getSheetByName(PRODUTOS_ABA);
  if (!aba) {
    aba = planilha.insertSheet(PRODUTOS_ABA);
    var cab = ['ID', 'Nome', 'Categoria', 'Preço', 'Imagem', 'Descrição', 'Ativo'];
    aba.getRange(1, 1, 1, cab.length).setValues([cab]);
    aba.getRange(1, 1, 1, cab.length).setBackground('#000').setFontColor('#fff').setFontWeight('bold');
    aba.setFrozenRows(1);
  }
  return aba;
}

function listarProdutos() {
  try {
    var aba = obterOuCriarAbaProdutos();
    var ultimaLinha = aba.getLastRow();
    if (ultimaLinha < 2) return { success: true, produtos: [], total: 0 };
    var dados = aba.getRange(2, 1, ultimaLinha - 1, 7).getValues();
    var produtos = [];
    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      if (!linha[0] && !linha[1]) continue;
      var ativoVal = linha[6];
      var ativo = (ativoVal === true || ativoVal === 'SIM' || ativoVal === 'sim' || ativoVal === 'TRUE')
                  && ativoVal !== false && ativoVal !== 'NÃO' && ativoVal !== 'NAO' && ativoVal !== 'FALSE';
      produtos.push({
        id: linha[0] || (i + 1),
        nome: linha[1] || '',
        categoria: linha[2] || '',
        preco: parseFloat(linha[3]) || 0,
        imagem: linha[4] || '',
        foto: linha[4] || '',
        descricao: linha[5] || '',
        ativo: ativo,
        linha: i + 2
      });
    }
    return { success: true, produtos: produtos, total: produtos.length };
  } catch (error) {
    return { success: false, error: error.message, produtos: [] };
  }
}

function salvarProduto(produto) {
  try {
    var aba = obterOuCriarAbaProdutos();
    var ultimaLinha = aba.getLastRow();
    if (produto.id && produto.id > 0) {
      if (ultimaLinha >= 2) {
        var dados = aba.getRange(2, 1, ultimaLinha - 1, 7).getValues();
        for (var i = 0; i < dados.length; i++) {
          if (String(dados[i][0]) === String(produto.id)) {
            var linha = i + 2;
            aba.getRange(linha, 2).setValue(produto.nome);
            aba.getRange(linha, 3).setValue(produto.categoria);
            aba.getRange(linha, 4).setValue(parseFloat(produto.preco));
            aba.getRange(linha, 5).setValue(produto.imagem);
            aba.getRange(linha, 6).setValue(produto.descricao);
            aba.getRange(linha, 7).setValue(produto.ativo ? 'SIM' : 'NÃO');
            return { success: true, message: 'Produto atualizado!', produtoId: produto.id };
          }
        }
      }
      return { success: false, message: 'Produto não encontrado (ID: ' + produto.id + ')' };
    }
    var proximoId = 1;
    if (ultimaLinha >= 2) {
      var ids = aba.getRange(2, 1, ultimaLinha - 1, 1).getValues();
      for (var j = 0; j < ids.length; j++) {
        var idAtual = parseInt(ids[j][0]) || 0;
        if (idAtual >= proximoId) proximoId = idAtual + 1;
      }
    }
    aba.appendRow([proximoId, produto.nome, produto.categoria, parseFloat(produto.preco), produto.imagem, produto.descricao, produto.ativo ? 'SIM' : 'NÃO']);
    return { success: true, message: 'Produto adicionado!', produtoId: proximoId };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deletarProduto(produtoId) {
  try {
    var aba = obterOuCriarAbaProdutos();
    if (aba.getLastRow() < 2) return { success: false, message: 'Planilha vazia' };
    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < dados.length; i++) {
      if (String(dados[i][0]) === String(produtoId)) {
        aba.deleteRow(i + 2);
        return { success: true, message: 'Produto deletado!' };
      }
    }
    return { success: false, message: 'Produto não encontrado' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function salvarPedidoCompleto(dados) {
  try {
    var idPedido = 'LIMA-' + new Date().getTime().toString().slice(-8) + '-' + Math.floor(Math.random() * 1000);
    var dataHora = new Date().toLocaleString('pt-BR');
    var infoComprovante = { success: false, url: '', id: '' };
    if (dados.metodoPagamento === 'PIX' && dados.comprovanteBase64) {
      infoComprovante = salvarComprovanteDrive(dados.comprovanteBase64, dados.comprovanteNome, idPedido);
    }
    var itensTexto = '';
    var totalCalculado = 0;
    if (dados.itens && Array.isArray(dados.itens)) {
      for (var i = 0; i < dados.itens.length; i++) {
        var item = dados.itens[i];
        var linhaItem = item.quantidade + 'x ' + item.nome;
        if (item.preco) { var sub = parseFloat(item.preco) * parseInt(item.quantidade); totalCalculado += sub; linhaItem += ' - R$ ' + sub.toFixed(2).replace('.', ','); }
        if (item.detalhes && item.detalhes.trim()) linhaItem += ' (' + item.detalhes + ')';
        itensTexto += (i > 0 ? '\n' : '') + linhaItem;
      }
    }
    var totalExibir = dados.total || totalCalculado.toFixed(2).replace('.', ',');
    var tipo = 'Entrega';
    if (dados.endereco && (dados.endereco.toLowerCase().includes('retirada') || dados.endereco.toLowerCase().includes('local'))) tipo = 'Retirada';
    var linhaPlanilha = [idPedido, dataHora, dados.cliente || '', dados.telefone || '', tipo, dados.endereco || '',
      dados.metodoPagamento || '', dados.troco || 'Não precisa', itensTexto, 'R$ ' + totalExibir,
      dados.observacoes || 'Nenhuma', 'NOVO', infoComprovante.url || '', infoComprovante.id || '', ''];
    var resultadoPlanilha = salvarNaPlanilhaGoogle(linhaPlanilha, dados.metodoPagamento);
    if (!resultadoPlanilha.success) return { success: false, message: 'Erro na planilha: ' + resultadoPlanilha.error };
    return { success: true, message: 'Pedido registrado!', pedidoId: idPedido, dataHora: dataHora, numeroWhatsapp: CONFIG.NUMERO_WHATSAPP,
      whatsappUrl: 'https://wa.me/' + CONFIG.NUMERO_WHATSAPP + '?text=' + encodeURIComponent('Olá! Pedido ' + idPedido + ' realizado.') };
  } catch (error) { return { success: false, message: 'Erro: ' + error.message }; }
}

function salvarNaPlanilhaGoogle(linhaDados, metodoPagamento) {
  try {
    var planilha = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    var aba = planilha.getSheetByName('Pedidos');
    if (!aba) {
      aba = planilha.insertSheet('Pedidos');
      var cab = ['ID', 'Data/Hora', 'Cliente', 'Telefone', 'Tipo', 'Endereço', 'Pagamento', 'Troco', 'Itens', 'Total', 'Observações', 'Status', 'Comprovante_URL', 'Comprovante_ID', 'Visualizar'];
      aba.getRange(1, 1, 1, cab.length).setValues([cab]);
      aba.getRange(1, 1, 1, cab.length).setBackground('#000').setFontColor('#fff').setFontWeight('bold');
      aba.setFrozenRows(1);
    }
    aba.appendRow(linhaDados);
    var numeroLinha = aba.getLastRow();
    if (metodoPagamento === 'PIX') aba.getRange(numeroLinha, 1, 1, 15).setBackground('#E8F5E9');
    if (linhaDados[12]) aba.getRange(numeroLinha, 15).setFormula('=HYPERLINK("' + linhaDados[12] + '", "Ver")');
    else aba.getRange(numeroLinha, 15).setValue('-');
    return { success: true, linha: numeroLinha };
  } catch (error) { return { success: false, error: error.message }; }
}

function listarPedidosParaAdmin() {
  try {
    var planilha = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    var aba = planilha.getSheetByName('Pedidos');
    if (!aba || aba.getLastRow() < 2) return { success: true, pedidos: [], total: 0, estatisticas: { total:0, novos:0, pix:0, comComprovante:0 } };
    var dados = aba.getRange(2, 1, aba.getLastRow() - 1, 15).getValues();
    var pedidos = [];
    var est = { total: 0, novos: 0, pix: 0, comComprovante: 0 };
    for (var i = 0; i < dados.length; i++) {
      var linha = dados[i];
      if (!linha[0]) continue;
      est.total++;
      var urlC = linha[12] || ''; var idC = linha[13] || '';
      if (!idC && urlC.includes('/d/')) { var m = urlC.match(/\/d\/([a-zA-Z0-9_-]+)/); if (m) idC = m[1]; }
      var temC = !!idC; if (temC) est.comComprovante++;
      var status = linha[11] || 'NOVO'; if (status === 'NOVO') est.novos++;
      var pag = linha[6] || ''; if (pag === 'PIX') est.pix++;
      pedidos.push({ linha: i+2, id: linha[0], data: linha[1], cliente: linha[2], telefone: linha[3], tipo: linha[4], endereco: linha[5], pagamento: pag, troco: linha[7], itens: linha[8], total: linha[9], observacoes: linha[10], status: status, comprovanteUrl: urlC, comprovanteId: idC, comprovanteThumbnail: idC ? 'https://drive.google.com/thumbnail?id='+idC+'&sz=w400' : '', comprovanteView: idC ? 'https://drive.google.com/file/d/'+idC+'/view' : '', temComprovante: temC });
    }
    pedidos.sort(function(a,b){ try { var p=function(s){ if(!s) return new Date(0); var pts=s.toString().split(' '), d=pts[0].split('/'), t=(pts[1]||'0:0:0').split(':'); return new Date(+d[2],+d[1]-1,+d[0],+t[0],+t[1],+(t[2]||0)); }; return p(b.data)-p(a.data); } catch(e2){return 0;} });
    return { success: true, pedidos: pedidos, estatisticas: est, atualizado: new Date().toLocaleString('pt-BR') };
  } catch (error) { return { success: false, error: error.message, pedidos: [] }; }
}

function atualizarStatusPedido(idPedido, novoStatus) {
  try {
    var planilha = SpreadsheetApp.openById(CONFIG.PLANILHA_ID);
    var aba = planilha.getSheetByName('Pedidos');
    if (!aba) return { success: false, message: 'Aba não encontrada' };
    var dados = aba.getDataRange().getValues();
    for (var i = 1; i < dados.length; i++) {
      if (String(dados[i][0]) === String(idPedido)) {
        aba.getRange(i+1,12).setValue(novoStatus);
        var cor='#fff'; if(novoStatus==='PREPARANDO')cor='#FFF3CD'; else if(novoStatus==='PRONTO')cor='#D1ECF1'; else if(novoStatus==='ENTREGUE')cor='#D4EDDA'; else if(novoStatus==='CANCELADO')cor='#F8D7DA';
        aba.getRange(i+1,1,1,15).setBackground(cor);
        return { success: true, message: 'Status: ' + novoStatus };
      }
    }
    return { success: false, message: 'Pedido não encontrado' };
  } catch (error) { return { success: false, message: error.message }; }
}

function salvarComprovanteDrive(base64Data, nomeOriginal, idPedido) {
  try {
    var pasta = DriveApp.getFolderById(CONFIG.PASTA_COMPROVANTES_ID);
    var mimeType = 'image/jpeg'; var b64 = base64Data;
    if (base64Data.includes(',')) { mimeType = base64Data.split(';')[0].replace('data:',''); b64 = base64Data.split(',')[1]; }
    var bytes = Utilities.base64Decode(b64);
    var blob = Utilities.newBlob(bytes, mimeType, nomeOriginal);
    var dataF = Utilities.formatDate(new Date(),'America/Sao_Paulo','ddMMyyyy_HHmmss');
    var ext = (nomeOriginal||'img.jpg').split('.').pop();
    var arquivo = pasta.createFile(blob);
    arquivo.setName('PIX_'+idPedido+'_'+dataF+'.'+ext);
    try { arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e2) {}
    return { success: true, id: arquivo.getId(), url: 'https://drive.google.com/file/d/'+arquivo.getId()+'/view' };
  } catch (error) { return { success: false, error: error.message }; }
}

function criarPaginaInicialWebApp() {
  return HtmlService.createHtmlOutput('<h1>Lima\'s Pizzaria - Sistema Online</h1>');
}

function testarTudo() {
  return { success: true, message: 'Sistema OK', planilha: CONFIG.PLANILHA_ID };
}
