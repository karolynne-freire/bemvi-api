import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
  Switch,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  updateEmail,
  signOut,
  deleteUser,
  onAuthStateChanged,
} from 'firebase/auth';

const OPCOES_DIFICULDADE = ['TEA', 'TDAH', 'TOD', 'OUTROS'];
const OPCOES_ESPECIALIDADE = [
  'Neuropediatra',
  'Psicólogo(a)',
  'Fonoaudiólogo(a)',
  'Terapeuta Ocupacional',
  'Psicopedagogo(a)',
  'Fisioterapeuta',
  'Outros',
];
const DESTAQUES_AVALIACAO = [
  'ACOLHEDORA',
  'PACIENTE',
  'HUMANIZADA',
  'ATENCIOSA',
];
const RELATOS_PADRAO = ['ACOLHEDORA', 'PACIENTE', 'HUMANIZADA'];
const FILTROS_PROFISSIONAIS = ['TEA', 'TDAH', 'TOD'];
const COR_CORACAO_VERMELHO = '#DC2626';

function criarFilhoVazio() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nome: '',
    dataNascimento: '', // formato DD/MM/AAAA
    idade: '',
    dificuldades: [],
    outraDificuldade: '',
  };
}

function calcularIdadeDeDataBR(dataStr) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataStr.trim());
  if (!match) return '';

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10);
  const ano = parseInt(match[3], 10);

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return '';

  const hoje = new Date();
  const nascimento = new Date(ano, mes - 1, dia);

  if (
    nascimento.getFullYear() !== ano ||
    nascimento.getMonth() !== mes - 1 ||
    nascimento.getDate() !== dia ||
    nascimento > hoje
  ) {
    return '';
  }

  let anos = hoje.getFullYear() - ano;
  const diferencaMeses = hoje.getMonth() - (mes - 1);
  if (diferencaMeses < 0 || (diferencaMeses === 0 && hoje.getDate() < dia)) {
    anos--;
  }

  if (anos < 0) return '';
  if (anos === 0) {
    let meses = (hoje.getFullYear() - ano) * 12 + (hoje.getMonth() - (mes - 1));
    if (hoje.getDate() < dia) meses--;
    return meses <= 0 ? 'Menos de 1 mês' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }

  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
}

function mensagemErroAuth(code) {
  switch (code) {
    case 'auth/invalid-email':
      return 'O formato do e-mail informado é inválido.';
    case 'auth/user-not-found':
      return 'Usuário não cadastrado. Crie uma conta para acessar.';
    case 'auth/wrong-password':
      return 'Senha incorreta. Verifique e tente novamente.';
    case 'auth/invalid-credential':
      return 'Usuário não cadastrado ou e-mail/senha incorretos.';
    case 'auth/user-disabled':
      return 'Esta conta foi desativada. Entre em contato com o suporte.';
    case 'auth/too-many-requests':
      return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
    case 'auth/email-already-in-use':
      return 'Este e-mail já possui uma conta cadastrada.';
    case 'auth/weak-password':
      return 'A senha é muito fraca. Utilize pelo menos 6 caracteres.';
    case 'auth/network-request-failed':
      return 'Sem conexão com a internet. Verifique sua rede e tente novamente.';
    case 'auth/operation-not-allowed':
      return 'O login por e-mail e senha não está habilitado no Firebase.';
    case 'auth/requires-recent-login':
      return 'Por segurança, faça login novamente para concluir alterações sensíveis na conta.';
    default:
      return 'Não foi possível concluir a operação. Tente novamente.';
  }
}

const getChavePerfilUsuario = (uid) => `@bemvi:perfil:${uid || 'convidado'}`;

export default function App() {
  // 'welcome' | 'login' | 'cadastro' | 'cadastro_filhos' | 'editar_mae' | 'home' | 'perfil_excluido'
  const [telaAtual, setTelaAtual] = useState('welcome');
  // 'inicio' | 'bem_vindo_mae' | 'apoio' | 'lista_profissionais' | 'profissionais' | 'adicionar_profissional' | 'avaliar_profissional' | 'detalhe_profissional' | 'mapa' | 'perfil'
  const [abaHome, setAbaHome] = useState('inicio');
  const [abaAnteriorProfissional, setAbaAnteriorProfissional] = useState('lista_profissionais');
  const [editandoFilhosPeloPerfil, setEditandoFilhosPeloPerfil] = useState(false);

  // Controla se a mãe atípica realizou o cadastro e habilita a tela "BEM-VINDO!"
  const [cadastrouMaeAtipica, setCadastrouMaeAtipica] = useState(false);
  const [maesOnline, setMaesOnline] = useState(0);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [avisoNaoCadastrado, setAvisoNaoCadastrado] = useState('');
  const [initializing, setInitializing] = useState(true);
  const [enviandoAuth, setEnviandoAuth] = useState(false);
  const [excluindoPerfil, setExcluindoPerfil] = useState(false);
  const [pedirConfirmacaoExclusao, setPedirConfirmacaoExclusao] = useState(false);
  const [confirmacaoExclusao, setConfirmacaoExclusao] = useState(null);

  // Campos temporários para correção do cadastro da mãe
  const [nomeEdit, setNomeEdit] = useState('');
  const [emailEdit, setEmailEdit] = useState('');
  const [salvandoMae, setSalvandoMae] = useState(false);

  // Estado para múltiplos filhos
  const [filhos, setFilhos] = useState([criarFilhoVazio()]);

  // Estado para busca, filtros, avaliação, detalhes e profissionais salvos
  const [buscaProfissional, setBuscaProfissional] = useState('');
  const [filtroTagProfissional, setFiltroTagProfissional] = useState('');
  const [profissionais, setProfissionais] = useState([]);
  const [profissionalEmAvaliacaoId, setProfissionalEmAvaliacaoId] = useState(null);
  const [coracoesAvaliacao, setCoracoesAvaliacao] = useState(5);
  const [destaquesAvaliacao, setDestaquesAvaliacao] = useState([
    'ACOLHEDORA',
    'PACIENTE',
    'HUMANIZADA',
  ]);
  const [relatoAvaliacao, setRelatoAvaliacao] = useState('');
  const [profissionalEmDetalhe, setProfissionalEmDetalhe] = useState(null);
  const [relatoExtraInput, setRelatoExtraInput] = useState('');
  const [mostrarInputRelatoExtra, setMostrarInputRelatoExtra] = useState(false);

  const [nomeProfissional, setNomeProfissional] = useState('');
  const [especialidadeProfissional, setEspecialidadeProfissional] = useState('');
  const [outraEspecialidadeProfissional, setOutraEspecialidadeProfissional] = useState('');
  const [mostrarOpcoesEspecialidade, setMostrarOpcoesEspecialidade] = useState(false);
  const [cidadeProfissional, setCidadeProfissional] = useState('RECIFE-PE');
  const [sobreProfissional, setSobreProfissional] = useState('');
  const [erroCadastroProfissional, setErroCadastroProfissional] = useState('');
  const [salvandoProfissional, setSalvandoProfissional] = useState(false);

  // Estado do modo anônimo no perfil
  const [modoAnonimo, setModoAnonimo] = useState(false);

  const persistirDadosPerfil = async (
    listaFilhos = filhos,
    nomeMae = nome,
    anonimo = modoAnonimo,
    cadastroMae = cadastrouMaeAtipica,
    listaProfissionais = profissionais,
    uidOverride = null
  ) => {
    try {
      const uid = uidOverride || auth.currentUser?.uid || 'convidado';
      const payload = {
        nome: (nomeMae || '').trim(),
        filhos: listaFilhos,
        profissionais: listaProfissionais,
        modoAnonimo: Boolean(anonimo),
        cadastrouMaeAtipica: Boolean(cadastroMae),
        atualizadoEm: new Date().toISOString(),
      };
      await AsyncStorage.setItem(getChavePerfilUsuario(uid), JSON.stringify(payload));
    } catch (err) {
      console.log('Erro ao salvar dados do perfil:', err);
    }
  };

  const limparFormularioProfissional = () => {
    setNomeProfissional('');
    setEspecialidadeProfissional('');
    setOutraEspecialidadeProfissional('');
    setMostrarOpcoesEspecialidade(false);
    setCidadeProfissional('RECIFE-PE');
    setSobreProfissional('');
    setErroCadastroProfissional('');
  };

  const limparEstadoSessao = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setMostrarSenha(false);
    setAvisoNaoCadastrado('');
    setModoAnonimo(false);
    setCadastrouMaeAtipica(false);
    setMaesOnline(0);
    setEditandoFilhosPeloPerfil(false);
    setPedirConfirmacaoExclusao(false);
    setFilhos([criarFilhoVazio()]);
    setBuscaProfissional('');
    setFiltroTagProfissional('');
    setProfissionais([]);
    setProfissionalEmAvaliacaoId(null);
    setCoracoesAvaliacao(5);
    setDestaquesAvaliacao(['ACOLHEDORA', 'PACIENTE', 'HUMANIZADA']);
    setRelatoAvaliacao('');
    setProfissionalEmDetalhe(null);
    setRelatoExtraInput('');
    setMostrarInputRelatoExtra(false);
    limparFormularioProfissional();
    setAbaHome('inicio');
    setTelaAtual('welcome');
  };

  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let nomeCarregado = '';
        let filhosCarregados = null;
        let profsCarregados = null;
        let anonimoCarregado = false;

        try {
          const salvo = await AsyncStorage.getItem(getChavePerfilUsuario(user.uid));
          if (salvo) {
            const dados = JSON.parse(salvo);
            if (dados.nome) {
              nomeCarregado = dados.nome;
              setNome(dados.nome);
            }
            if (typeof dados.modoAnonimo === 'boolean') {
              anonimoCarregado = dados.modoAnonimo;
              setModoAnonimo(dados.modoAnonimo);
            }
            if (Array.isArray(dados.filhos) && dados.filhos.length > 0) {
              filhosCarregados = dados.filhos;
              setFilhos(dados.filhos);
            }
            if (Array.isArray(dados.profissionais)) {
              profsCarregados = dados.profissionais;
              setProfissionais(dados.profissionais);
            }
          }
          if (user.email) setEmail(user.email);
          const nomeFinal =
            nomeCarregado ||
            user.displayName ||
            (user.email ? user.email.split('@')[0] : '');
          if (nomeFinal && !nomeCarregado) setNome(nomeFinal);

          setCadastrouMaeAtipica(true);
          setMaesOnline(1);
          setAbaHome((prev) => (prev === 'inicio' ? 'bem_vindo_mae' : prev));

          await persistirDadosPerfil(
            filhosCarregados || filhos,
            nomeFinal,
            anonimoCarregado,
            true,
            profsCarregados || profissionais,
            user.uid
          );
        } catch (err) {
          console.log('Erro ao carregar dados do perfil:', err);
        }

        setTelaAtual((prev) =>
          prev === 'cadastro_filhos' || prev === 'editar_mae' || prev === 'perfil_excluido'
            ? prev
            : 'home'
        );
      } else {
        setMaesOnline(0);
        setTelaAtual((prev) =>
          prev === 'home' || prev === 'cadastro_filhos' || prev === 'editar_mae'
            ? 'welcome'
            : prev
        );
      }
      if (initializing) setInitializing(false);
    });
    return subscriber;
  }, [initializing]);

  const abrirCorrecaoMae = () => {
    const nomeAtual =
      nome.trim() ||
      auth.currentUser?.displayName?.trim() ||
      (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : '') ||
      '';
    const emailAtual = email.trim() || auth.currentUser?.email || '';

    setNomeEdit(nomeAtual);
    setEmailEdit(emailAtual);
    setTelaAtual('editar_mae');
  };

  const handleSalvarCorrecaoMae = async () => {
    if (salvandoMae) return;

    const nomeLimpo = nomeEdit.trim();
    const emailLimpo = emailEdit.trim();

    if (!nomeLimpo) {
      Alert.alert('Atenção', 'Por favor, informe o seu nome.');
      return;
    }

    if (!emailLimpo || !emailLimpo.includes('@')) {
      Alert.alert('Atenção', 'Por favor, informe um e-mail válido.');
      return;
    }

    setSalvandoMae(true);
    let avisoEmail = '';

    try {
      const currentUser = auth.currentUser;

      if (currentUser) {
        try {
          await updateProfile(currentUser, { displayName: nomeLimpo });
        } catch (profileErr) {
          console.log('Aviso ao atualizar displayName:', profileErr);
        }

        if (currentUser.email && emailLimpo.toLowerCase() !== currentUser.email.toLowerCase()) {
          try {
            await updateEmail(currentUser, emailLimpo);
          } catch (emailErr) {
            console.log('Aviso ao atualizar e-mail no Auth:', emailErr.code, emailErr.message);
            avisoEmail = `\n\nNota: ${mensagemErroAuth(emailErr.code)}`;
          }
        }
      }

      setNome(nomeLimpo);
      setEmail(emailLimpo);

      await persistirDadosPerfil(
        filhos,
        nomeLimpo,
        modoAnonimo,
        cadastrouMaeAtipica,
        profissionais
      );

      Alert.alert('Cadastro atualizado!', `Seus dados foram salvos com sucesso.${avisoEmail}`);
      setAbaHome('perfil');
      setTelaAtual('home');
    } catch (err) {
      console.log('Erro ao salvar correção da mãe:', err);
      Alert.alert('Erro', 'Não foi possível salvar as alterações do cadastro.');
    } finally {
      setSalvandoMae(false);
    }
  };

  const adicionarFilho = () => {
    setFilhos((prev) => [...prev, criarFilhoVazio()]);
  };

  const removerFilho = (id) => {
    setFilhos((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.id !== id);
    });
  };

  const atualizarCampoFilho = (id, campo, valor) => {
    setFilhos((prev) =>
      prev.map((filho) => {
        if (filho.id !== id) return filho;

        if (campo === 'dataNascimento') {
          const idadeCalculada = calcularIdadeDeDataBR(valor);
          return {
            ...filho,
            dataNascimento: valor,
            idade: idadeCalculada || filho.idade,
          };
        }

        return { ...filho, [campo]: valor };
      })
    );
  };

  const alternarDificuldadeFilho = (id, dificuldade) => {
    setFilhos((prev) =>
      prev.map((filho) => {
        if (filho.id !== id) return filho;
        const existe = filho.dificuldades.includes(dificuldade);
        const novasDificuldades = existe
          ? filho.dificuldades.filter((item) => item !== dificuldade)
          : [...filho.dificuldades, dificuldade];
        return { ...filho, dificuldades: novasDificuldades };
      })
    );
  };

  const abrirEdicaoFilhos = (vindoDoPerfil = false) => {
    setEditandoFilhosPeloPerfil(vindoDoPerfil);
    setTelaAtual('cadastro_filhos');
  };

  const concluirCadastroFilhos = (destinoAba = 'bem_vindo_mae') => {
    setEditandoFilhosPeloPerfil(false);
    setAbaHome(destinoAba);
    setTelaAtual('home');
  };

  const handleAlternarAnonimo = async (valor) => {
    setModoAnonimo(valor);
    await persistirDadosPerfil(filhos, nome, valor, cadastrouMaeAtipica, profissionais);
  };

  const handleAvaliarCoracoesProfissional = async (profId, nota) => {
    const notaLimitada = Math.max(1, Math.min(5, nota));
    const listaAtualizada = profissionais.map((p) =>
      p.id === profId ? { ...p, coracoes: notaLimitada } : p
    );
    setProfissionais(listaAtualizada);
    setProfissionalEmDetalhe((prev) =>
      prev && prev.id === profId ? { ...prev, coracoes: notaLimitada } : prev
    );
    await persistirDadosPerfil(
      filhos,
      nome,
      modoAnonimo,
      cadastrouMaeAtipica,
      listaAtualizada
    );
  };

  const handleExcluirProfissionalSalvo = async (prof) => {
    if (!prof) return;
    const listaAtualizada = profissionais.filter((p) => p.id !== prof.id);
    setProfissionais(listaAtualizada);
    setProfissionalEmDetalhe((prev) => (prev && prev.id === prof.id ? null : prev));
    await persistirDadosPerfil(
      filhos,
      nome,
      modoAnonimo,
      cadastrouMaeAtipica,
      listaAtualizada
    );
  };

  const abrirDetalheProfissional = (prof, origem = 'lista_profissionais') => {
    setAbaAnteriorProfissional(origem);
    const relatosIniciais =
      Array.isArray(prof.relatos) && prof.relatos.length > 0
        ? prof.relatos
        : ['ACOLHEDORA'];
    setProfissionalEmDetalhe({
      ...prof,
      coracoes: typeof prof.coracoes === 'number' ? prof.coracoes : 5,
      relatos: relatosIniciais,
    });
    setRelatoExtraInput('');
    setMostrarInputRelatoExtra(false);
    setAbaHome('detalhe_profissional');
  };

  const alternarRelatoDetalhe = (relatoTag) => {
    setProfissionalEmDetalhe((prev) => {
      if (!prev) return prev;
      const atuais = Array.isArray(prev.relatos) ? prev.relatos : [];
      const existe = atuais.includes(relatoTag);
      const proximos = existe
        ? atuais.filter((item) => item !== relatoTag)
        : [...atuais, relatoTag];
      return { ...prev, relatos: proximos };
    });
  };

  const adicionarRelatoExtraDetalhe = () => {
    const limpo = relatoExtraInput.trim().toUpperCase();
    if (!limpo) return;
    setProfissionalEmDetalhe((prev) => {
      if (!prev) return prev;
      const atuais = Array.isArray(prev.relatos) ? prev.relatos : [];
      const proximos = atuais.includes(limpo) ? atuais : [...atuais, limpo];
      return { ...prev, relatos: proximos };
    });
    setRelatoExtraInput('');
    setMostrarInputRelatoExtra(false);
  };

  const handleSalvarDetalheProfissional = async () => {
    if (!profissionalEmDetalhe) return;

    const tagsSelecionadas = filhos.flatMap((f) => f.dificuldades || []);
    const tagsUnicas = Array.from(
      new Set([
        ...(Array.isArray(profissionalEmDetalhe.tags)
          ? profissionalEmDetalhe.tags
          : []),
        ...tagsSelecionadas.filter((t) => FILTROS_PROFISSIONAIS.includes(t)),
      ])
    );

    const itemParaSalvar = {
      ...profissionalEmDetalhe,
      tags: tagsUnicas.length > 0 ? tagsUnicas : ['TEA'],
      coracoes:
        typeof profissionalEmDetalhe.coracoes === 'number'
          ? profissionalEmDetalhe.coracoes
          : 5,
      relatos:
        Array.isArray(profissionalEmDetalhe.relatos) &&
        profissionalEmDetalhe.relatos.length > 0
          ? profissionalEmDetalhe.relatos
          : ['ACOLHEDORA'],
    };

    const jaExiste = profissionais.some((p) => p.id === itemParaSalvar.id);
    const listaAtualizada = jaExiste
      ? profissionais.map((p) => (p.id === itemParaSalvar.id ? itemParaSalvar : p))
      : [itemParaSalvar, ...profissionais];

    setProfissionais(listaAtualizada);
    setProfissionalEmDetalhe(itemParaSalvar);
    await persistirDadosPerfil(
      filhos,
      nome,
      modoAnonimo,
      cadastrouMaeAtipica,
      listaAtualizada
    );

    Alert.alert('Profissional salvo!', 'A indicação foi salva na sua lista.');
    setAbaHome('lista_profissionais');
  };

  const handleCompartilharProfissional = async (prof) => {
    if (!prof) return;
    const relatosTexto =
      Array.isArray(prof.relatos) && prof.relatos.length > 0
        ? `\nRelatos: ${prof.relatos.join(', ')}`
        : '';
    const coracoesTexto = '♥'.repeat(
      typeof prof.coracoes === 'number' ? prof.coracoes : 5
    );

    const mensagem = `Indicação Bemvi:\n${(prof.nome || '').toUpperCase()}\nEspecialidade: ${(
      prof.especialidade || ''
    ).toUpperCase()}\nCidade: ${(prof.cidade || '').toUpperCase()}\nAvaliação: ${coracoesTexto}${relatosTexto}\nSobre: ${
      prof.sobre || ''
    }`;

    try {
      await Share.share({ message: mensagem });
    } catch (err) {
      console.log('Erro ao compartilhar profissional:', err);
    }
  };

  const alternarDestaqueAvaliacao = (tag) => {
    setDestaquesAvaliacao((prev) =>
      prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]
    );
  };

  const handleConcluirIndicacao = async () => {
    const alvo =
      profissionais.find((p) => p.id === profissionalEmAvaliacaoId) ||
      profissionalEmDetalhe;

    if (!alvo) {
      setAbaHome('lista_profissionais');
      return;
    }

    const relatoLimpo = relatoAvaliacao.trim();
    const destaquesFinais =
      destaquesAvaliacao.length > 0 ? destaquesAvaliacao : ['ACOLHEDORA'];
    const notaFinal = Math.max(1, Math.min(5, coracoesAvaliacao));

    const profissionalAtualizado = {
      ...alvo,
      coracoes: notaFinal,
      relatos: destaquesFinais,
      relatoMae: relatoLimpo,
      sobre: relatoLimpo || alvo.sobre,
    };

    const listaAtualizada = profissionais.some((p) => p.id === profissionalAtualizado.id)
      ? profissionais.map((p) =>
          p.id === profissionalAtualizado.id ? profissionalAtualizado : p
        )
      : [profissionalAtualizado, ...profissionais];

    setProfissionais(listaAtualizada);
    setProfissionalEmDetalhe(profissionalAtualizado);
    setAbaAnteriorProfissional('lista_profissionais');

    await persistirDadosPerfil(
      filhos,
      nome,
      modoAnonimo,
      cadastrouMaeAtipica,
      listaAtualizada
    );

    Alert.alert(
      'Indicação concluída!',
      `Avaliação de ${notaFinal} ${
        notaFinal === 1 ? 'coração' : 'corações'
      } salva para outras mães verem.`
    );
    setAbaHome('detalhe_profissional');
  };

  const handleProximoProfissional = async () => {
    if (salvandoProfissional) return;

    const nomeLimpo = nomeProfissional.trim();
    const especialidadeLimpa =
      especialidadeProfissional === 'Outros'
        ? outraEspecialidadeProfissional.trim()
        : especialidadeProfissional.trim();
    const cidadeLimpa = cidadeProfissional.trim();
    const sobreLimpo = sobreProfissional.trim();

    if (!nomeLimpo) {
      setErroCadastroProfissional('Informe o nome do profissional.');
      return;
    }

    if (!especialidadeLimpa) {
      setErroCadastroProfissional(
        especialidadeProfissional === 'Outros'
          ? 'Digite a especialidade do profissional.'
          : 'Selecione uma especialidade.'
      );
      return;
    }

    if (!cidadeLimpa) {
      setErroCadastroProfissional('Informe a cidade do atendimento.');
      return;
    }

    if (!sobreLimpo) {
      setErroCadastroProfissional('Preencha o campo sobre o profissional.');
      return;
    }

    setSalvandoProfissional(true);
    setErroCadastroProfissional('');

    try {
      const tagsSelecionadas = filhos.flatMap((f) => f.dificuldades || []);
      const tagsUnicas = Array.from(
        new Set(
          tagsSelecionadas.filter((t) => FILTROS_PROFISSIONAIS.includes(t))
        )
      );

      const novoProfissional = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nome: nomeLimpo,
        especialidade: especialidadeLimpa,
        cidade: cidadeLimpa.toUpperCase(),
        sobre: sobreLimpo,
        coracoes: 5,
        tags: tagsUnicas.length > 0 ? tagsUnicas : ['TEA'],
        relatos: ['ACOLHEDORA', 'PACIENTE', 'HUMANIZADA'],
        indicadoPor: modoAnonimo ? 'Mãe atípica (Anônima)' : nome.trim() || 'Mãe atípica',
        criadoEm: new Date().toISOString(),
      };

      const listaAtualizada = [novoProfissional, ...profissionais];
      setProfissionais(listaAtualizada);
      setProfissionalEmAvaliacaoId(novoProfissional.id);
      setProfissionalEmDetalhe(novoProfissional);
      setCoracoesAvaliacao(5);
      setDestaquesAvaliacao(['ACOLHEDORA', 'PACIENTE', 'HUMANIZADA']);
      setRelatoAvaliacao('');

      await persistirDadosPerfil(
        filhos,
        nome,
        modoAnonimo,
        cadastrouMaeAtipica,
        listaAtualizada
      );

      limparFormularioProfissional();
      setAbaHome('avaliar_profissional');
    } catch (err) {
      console.log('Erro ao preparar avaliação do profissional:', err);
      setErroCadastroProfissional('Não foi possível avançar para a avaliação.');
    } finally {
      setSalvandoProfissional(false);
    }
  };

  const handleLogin = async () => {
    if (enviandoAuth) return;

    setAvisoNaoCadastrado('');
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!emailLimpo || !senhaLimpa) {
      setAvisoNaoCadastrado('Preencha o e-mail e a senha para acessar.');
      return;
    }

    setEnviandoAuth(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, emailLimpo, senhaLimpa);
      let nomePerfil =
        cred.user.displayName ||
        (cred.user.email ? cred.user.email.split('@')[0] : '') ||
        nome;
      let filhosPerfil = filhos;
      let profsPerfil = profissionais;
      let anonimoPerfil = modoAnonimo;

      try {
        const salvo = await AsyncStorage.getItem(getChavePerfilUsuario(cred.user.uid));
        if (salvo) {
          const dados = JSON.parse(salvo);
          if (dados.nome) {
            nomePerfil = dados.nome;
            setNome(dados.nome);
          }
          if (typeof dados.modoAnonimo === 'boolean') {
            anonimoPerfil = dados.modoAnonimo;
            setModoAnonimo(dados.modoAnonimo);
          }
          if (Array.isArray(dados.filhos) && dados.filhos.length > 0) {
            filhosPerfil = dados.filhos;
            setFilhos(dados.filhos);
          }
          if (Array.isArray(dados.profissionais)) {
            profsPerfil = dados.profissionais;
            setProfissionais(dados.profissionais);
          }
        }
      } catch (err) {
        console.log('Erro ao ler perfil no login:', err);
      }

      setCadastrouMaeAtipica(true);
      setMaesOnline(1);
      await persistirDadosPerfil(
        filhosPerfil,
        nomePerfil,
        anonimoPerfil,
        true,
        profsPerfil,
        cred.user.uid
      );

      setAvisoNaoCadastrado('');
      setAbaHome('bem_vindo_mae');
      setTelaAtual('home');
    } catch (error) {
      console.log('Erro no Login:', error?.code, error?.message);
      setAvisoNaoCadastrado(mensagemErroAuth(error?.code));
    } finally {
      setEnviandoAuth(false);
    }
  };

  const handleRegister = async () => {
    if (enviandoAuth) return;

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    const senhaLimpa = senha.trim();

    if (!nomeLimpo || !emailLimpo || !senhaLimpa) {
      Alert.alert('Atenção', 'Por favor, preencha nome, e-mail e senha para se cadastrar.');
      return;
    }

    if (senhaLimpa.length < 6) {
      Alert.alert('Atenção', 'A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setEnviandoAuth(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, emailLimpo, senhaLimpa);

      try {
        await updateProfile(userCredential.user, { displayName: nomeLimpo });
      } catch (profileError) {
        console.log('Aviso ao atualizar perfil:', profileError.code, profileError.message);
      }

      const filhosIniciais = [criarFilhoVazio()];
      setCadastrouMaeAtipica(true);
      setMaesOnline(1);
      setFilhos(filhosIniciais);
      setProfissionais([]);
      setEditandoFilhosPeloPerfil(false);
      setAvisoNaoCadastrado('');

      await persistirDadosPerfil(
        filhosIniciais,
        nomeLimpo,
        modoAnonimo,
        true,
        [],
        userCredential.user.uid
      );

      Alert.alert(
        'Conta criada!',
        'Agora adicione as informações dos seus filhos para personalizar seu acolhimento.'
      );
      setTelaAtual('cadastro_filhos');
    } catch (error) {
      console.log('Erro ao criar conta:', error.code, error.message);

      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(
          'E-mail já cadastrado',
          'Este e-mail já possui uma conta. Deseja fazer login com ele?',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Ir para Login',
              onPress: () => {
                setMostrarSenha(false);
                setAvisoNaoCadastrado('');
                setTelaAtual('login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Erro ao criar conta', mensagemErroAuth(error.code));
      }
    } finally {
      setEnviandoAuth(false);
    }
  };

  const handleSalvarFilhos = async () => {
    const filhosValidos = filhos.filter((f) => f.nome.trim().length > 0);

    if (filhosValidos.length === 0) {
      Alert.alert(
        'Atenção',
        'Informe pelo menos o nome de um filho ou toque em "Pular por agora".'
      );
      return;
    }

    const dadosFormatados = filhosValidos.map((f) => ({
      id: f.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nome: f.nome.trim(),
      dataNascimento: f.dataNascimento.trim(),
      idade: f.idade.trim() || calcularIdadeDeDataBR(f.dataNascimento),
      dificuldades: f.dificuldades,
      outraDificuldade: f.outraDificuldade.trim(),
    }));

    setFilhos(dadosFormatados);
    await persistirDadosPerfil(
      dadosFormatados,
      nome,
      modoAnonimo,
      cadastrouMaeAtipica,
      profissionais
    );

    Alert.alert('Tudo certo!', `${dadosFormatados.length} filho(a)(s) registrado(s) com sucesso.`);
    concluirCadastroFilhos(
      editandoFilhosPeloPerfil
        ? 'perfil'
        : cadastrouMaeAtipica
        ? 'bem_vindo_mae'
        : 'inicio'
    );
  };

  const handleLogout = async () => {
    if (enviandoAuth || excluindoPerfil) return;

    setEnviandoAuth(true);
    try {
      await signOut(auth);
      limparEstadoSessao();
    } catch (error) {
      console.log('Erro ao sair:', error.code, error.message);
      Alert.alert('Erro ao sair', mensagemErroAuth(error.code));
    } finally {
      setEnviandoAuth(false);
    }
  };

  const executarExclusaoPerfil = async () => {
    if (excluindoPerfil) return;
    setExcluindoPerfil(true);
    setPedirConfirmacaoExclusao(false);

    const currentUser = auth.currentUser;
    const uidAtual = currentUser?.uid || 'convidado';
    const chavePrincipal = getChavePerfilUsuario(uidAtual);

    let localRemovido = false;
    let contaAuthRemovida = false;
    let exigiuReautenticacao = false;
    let erroAuthDetalhe = '';

    try {
      await AsyncStorage.removeItem(chavePrincipal);
      if (uidAtual !== 'convidado') {
        await AsyncStorage.removeItem(getChavePerfilUsuario('convidado'));
      }
      const restante = await AsyncStorage.getItem(chavePrincipal);
      localRemovido = restante === null;
    } catch (storageErr) {
      console.log('Erro ao remover dados locais do perfil:', storageErr);
      localRemovido = false;
    }

    if (currentUser) {
      try {
        await deleteUser(currentUser);
        contaAuthRemovida = true;
      } catch (authErr) {
        console.log('Erro ao excluir usuário no Auth:', authErr?.code, authErr?.message);
        contaAuthRemovida = false;

        if (authErr?.code === 'auth/requires-recent-login') {
          exigiuReautenticacao = true;
          erroAuthDetalhe =
            'A conta no Firebase exige login recente para ser excluída permanentemente.';
          try {
            await signOut(auth);
          } catch (signOutErr) {
            console.log('Erro ao encerrar sessão após requires-recent-login:', signOutErr);
          }
        } else {
          erroAuthDetalhe = mensagemErroAuth(authErr?.code);
        }
      }
    } else {
      contaAuthRemovida = true;
    }

    const agora = new Date();
    const dataHoraFormatada = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString(
      'pt-BR',
      { hour: '2-digit', minute: '2-digit' }
    )}`;

    const resumoConfirmacao = {
      localRemovido,
      contaAuthRemovida,
      exigiuReautenticacao,
      erroAuthDetalhe,
      uidRemovido: uidAtual,
      dataHora: dataHoraFormatada,
    };

    limparEstadoSessao();
    setConfirmacaoExclusao(resumoConfirmacao);
    setTelaAtual('perfil_excluido');
    setExcluindoPerfil(false);
  };

  // TELA DE CONFIRMAÇÃO DE EXCLUSÃO DE PERFIL
  if (telaAtual === 'perfil_excluido' && confirmacaoExclusao) {
    const tudoExcluido =
      confirmacaoExclusao.localRemovido && confirmacaoExclusao.contaAuthRemovida;

    return (
      <SafeAreaView style={styles.containerFilhos}>
        <View style={styles.loginContent}>
          <Text style={styles.loginTitle}>
            {tudoExcluido ? 'PERFIL EXCLUÍDO' : 'EXCLUSÃO REGISTRADA'}
          </Text>
          <Text style={styles.loginSubtitle}>
            {tudoExcluido
              ? 'Confirmamos que o perfil e os dados associados foram removidos.'
              : 'Confira abaixo o status de cada etapa da exclusão:'}
          </Text>

          <View style={styles.cardFilho}>
            <Text style={styles.cartaoFilhoNome}>Comprovante de ação</Text>
            <Text style={styles.cartaoFilhoDetalhe}>
              Data/Hora: {confirmacaoExclusao.dataHora}
            </Text>
            <Text style={styles.cartaoFilhoDetalhe}>
              Identificador: {confirmacaoExclusao.uidRemovido}
            </Text>
            <Text style={styles.cartaoFilhoDetalhe}>
              Dados locais (AsyncStorage):{' '}
              {confirmacaoExclusao.localRemovido
                ? 'Excluídos e verificados'
                : 'Falha na remoção'}
            </Text>
            <Text style={styles.cartaoFilhoDetalhe}>
              Conta de autenticação:{' '}
              {confirmacaoExclusao.contaAuthRemovida
                ? 'Excluída'
                : 'Pendente (exige login recente)'}
            </Text>
            {confirmacaoExclusao.erroAuthDetalhe ? (
              <Text style={styles.textoRemoverFilho}>
                {confirmacaoExclusao.erroAuthDetalhe}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.btnLogin}
            onPress={() => {
              setConfirmacaoExclusao(null);
              setTelaAtual('welcome');
            }}
          >
            <Text style={styles.btnLoginText}>VOLTAR AO INÍCIO</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // TELA 1: APRESENTACAO
  if (telaAtual === 'welcome') {
    return (
      <View style={styles.containerWelcome}>
        <View style={styles.imageContainer}>
          <Image
            source={require('./BEMVI_01.png')}
            style={styles.logo}
          />
        </View>

        <View style={styles.textContainerWelcome}>
          <Text style={styles.textoAcolhimento}>
            Plataforma de acolhimento, conexão e indicação para mães atípicas,
            criada para fortalecer redes de apoio, facilitar o acesso a profissionais e
            promover inclusão no dia a dia.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.btnSeta}
          onPress={() => setTelaAtual('login')}
        >
          <Ionicons name="arrow-forward" size={24} color="#FFF" />
        </TouchableOpacity>

        <StatusBar style="auto" />
      </View>
    );
  }

  // TELA 2: LOGIN COM FIREBASE
  if (telaAtual === 'login') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <View style={styles.loginContent}>
          <Text style={styles.loginTitle}>Bemvi</Text>
          <Text style={styles.loginSubtitle}>LOGIN — Entre para aceder à sua rede de apoio.</Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>E-mail</Text>
            <TextInput
              style={styles.input}
              placeholder="Digite o seu e-mail"
              placeholderTextColor="#888"
              value={email}
              onChangeText={(texto) => {
                setEmail(texto);
                if (avisoNaoCadastrado) setAvisoNaoCadastrado('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Senha</Text>
            <View style={styles.inputSenhaWrapper}>
              <TextInput
                style={styles.inputSenha}
                placeholder="Digite a sua senha"
                placeholderTextColor="#888"
                value={senha}
                onChangeText={(texto) => {
                  setSenha(texto);
                  if (avisoNaoCadastrado) setAvisoNaoCadastrado('');
                }}
                secureTextEntry={!mostrarSenha}
              />
              <TouchableOpacity
                style={styles.btnOlho}
                onPress={() => setMostrarSenha(!mostrarSenha)}
              >
                <Ionicons
                  name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                  size={22}
                  color="#3E5C5B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {avisoNaoCadastrado ? (
            <View style={styles.caixaAvisoNaoCadastrado}>
              <Text style={styles.textoAvisoNaoCadastrado}>{avisoNaoCadastrado}</Text>
              <TouchableOpacity
                onPress={() => {
                  setMostrarSenha(false);
                  setAvisoNaoCadastrado('');
                  setTelaAtual('cadastro');
                }}
              >
                <Text style={styles.linkCriarContaAviso}>
                  Não possui conta? Criar cadastro agora →
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.btnLogin, enviandoAuth && styles.btnDesabilitado]}
            onPress={handleLogin}
            disabled={enviandoAuth}
          >
            <Text style={styles.btnLoginText}>
              {enviandoAuth ? 'ENTRANDO...' : 'ACESSAR'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.textoPergunta}>PRIMEIRA VEZ?</Text>

          <TouchableOpacity
            style={styles.btnVerdeDestaque}
            onPress={() => {
              setMostrarSenha(false);
              setAvisoNaoCadastrado('');
              setTelaAtual('cadastro');
            }}
          >
            <Text style={styles.btnVerdeDestaqueText}>CRIE SUA CONTA AQUI!</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnVoltar}
            onPress={() => {
              setAvisoNaoCadastrado('');
              setTelaAtual('welcome');
            }}
          >
            <Text style={styles.btnVoltarText}>← Voltar</Text>
          </TouchableOpacity>
        </View>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // TELA 2.1: CADASTRO MÃE ATÍPICA
  if (telaAtual === 'cadastro') {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.containerLogin}
      >
        <ScrollView contentContainerStyle={styles.scrollCadastro} showsVerticalScrollIndicator={false}>
          <View style={styles.loginContent}>
            <Text style={styles.loginTitle}>CADASTRO</Text>
            <Text style={styles.loginSubtitle}>
              Crie sua conta para fazer parte da comunidade das mães atípicas.
            </Text>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Nome</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite seu nome completo"
                placeholderTextColor="#888"
                value={nome}
                onChangeText={setNome}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <TextInput
                style={styles.input}
                placeholder="Digite o seu e-mail"
                placeholderTextColor="#888"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View style={styles.inputSenhaWrapper}>
                <TextInput
                  style={styles.inputSenha}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#888"
                  value={senha}
                  onChangeText={setSenha}
                  secureTextEntry={!mostrarSenha}
                />
                <TouchableOpacity
                  style={styles.btnOlho}
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                >
                  <Ionicons
                    name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="#3E5C5B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btnLogin, enviandoAuth && styles.btnDesabilitado]}
              onPress={handleRegister}
              disabled={enviandoAuth}
            >
              <Text style={styles.btnLoginText}>
                {enviandoAuth ? 'CADASTRANDO...' : 'CADASTRAR E ADICIONAR FILHOS'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.textoPergunta}>JÁ TEM CADASTRO?</Text>

            <TouchableOpacity
              style={styles.btnVerdeDestaque}
              onPress={() => {
                setMostrarSenha(false);
                setAvisoNaoCadastrado('');
                setTelaAtual('login');
              }}
            >
              <Text style={styles.btnVerdeDestaqueText}>REALIZE LOGIN AQUI!</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <StatusBar style="auto" />
      </KeyboardAvoidingView>
    );
  }

  // TELA 2.1B: CORRIGIR CADASTRO DA MÃE ATÍPICA (APENAS DADOS DA MÃE)
  if (telaAtual === 'editar_mae') {
    return (
      <SafeAreaView style={styles.containerFilhos}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollFilhos}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.loginContent}>
              <Text style={styles.loginTitle}>CORRIGIR CADASTRO</Text>
              <Text style={styles.loginSubtitle}>
                Atualize seus dados pessoais para manter seu perfil correto.
              </Text>

              <View style={styles.cardFilho}>
                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Nome completo</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite seu nome completo"
                    placeholderTextColor="#888"
                    value={nomeEdit}
                    onChangeText={setNomeEdit}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>E-mail</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Digite seu e-mail"
                    placeholderTextColor="#888"
                    value={emailEdit}
                    onChangeText={setEmailEdit}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btnLogin, salvandoMae && styles.btnDesabilitado]}
                onPress={handleSalvarCorrecaoMae}
                disabled={salvandoMae}
              >
                <Text style={styles.btnLoginText}>
                  {salvandoMae ? 'SALVANDO...' : 'SALVAR ALTERAÇÕES'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnVoltar}
                onPress={() => {
                  setAbaHome('perfil');
                  setTelaAtual('home');
                }}
              >
                <Text style={styles.btnVoltarText}>← Voltar ao perfil</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // TELA 2.2: CADASTRO / EDIÇÃO DOS FILHOS
  if (telaAtual === 'cadastro_filhos') {
    return (
      <SafeAreaView style={styles.containerFilhos}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollFilhos}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.loginContent}>
              <Text style={styles.loginTitle}>SEUS FILHOS</Text>
              <Text style={styles.loginSubtitle}>
                {nome ? `${nome.trim()}, adicione` : 'Adicione'} quantos filhos precisar, com data de nascimento, idade e dificuldades/neurodivergências.
              </Text>

              {filhos.map((filho, index) => (
                <View key={filho.id} style={styles.cardFilho}>
                  <View style={styles.cardFilhoHeader}>
                    <Text style={styles.cardFilhoTitulo}>Filho(a) {index + 1}</Text>
                    {filhos.length > 1 && (
                      <TouchableOpacity
                        onPress={() => removerFilho(filho.id)}
                        style={styles.btnRemoverFilho}
                      >
                        <Ionicons name="trash-outline" size={18} color="#B91C1C" />
                        <Text style={styles.textoRemoverFilho}>Remover</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Nome do(a) filho(a)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex.: Lucas"
                      placeholderTextColor="#888"
                      value={filho.nome}
                      onChangeText={(texto) => atualizarCampoFilho(filho.id, 'nome', texto)}
                    />
                  </View>

                  <View style={styles.linhaDataIdade}>
                    <View style={styles.colunaData}>
                      <Text style={styles.inputLabel}>Data de nascimento</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="DD/MM/AAAA"
                        placeholderTextColor="#888"
                        value={filho.dataNascimento}
                        onChangeText={(texto) =>
                          atualizarCampoFilho(filho.id, 'dataNascimento', texto)
                        }
                        keyboardType="numeric"
                        maxLength={10}
                      />
                    </View>

                    <View style={styles.colunaIdade}>
                      <Text style={styles.inputLabel}>Idade</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ex.: 7 anos"
                        placeholderTextColor="#888"
                        value={filho.idade}
                        onChangeText={(texto) => atualizarCampoFilho(filho.id, 'idade', texto)}
                      />
                    </View>
                  </View>

                  <View style={styles.tiposContainer}>
                    <Text style={styles.inputLabel}>Identificação / Neurodivergências</Text>
                    <View style={styles.chipsWrapper}>
                      {OPCOES_DIFICULDADE.map((opcao) => {
                        const selecionado = filho.dificuldades.includes(opcao);
                        return (
                          <TouchableOpacity
                            key={opcao}
                            style={[styles.chip, selecionado && styles.chipAtivo]}
                            onPress={() => alternarDificuldadeFilho(filho.id, opcao)}
                          >
                            <Text style={[styles.chipTexto, selecionado && styles.chipTextoAtivo]}>
                              {opcao}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Outra dificuldade / observação (opcional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Ex.: Dislexia, seletividade alimentar, fala..."
                      placeholderTextColor="#888"
                      value={filho.outraDificuldade}
                      onChangeText={(texto) =>
                        atualizarCampoFilho(filho.id, 'outraDificuldade', texto)
                      }
                    />
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.btnAdicionarFilho} onPress={adicionarFilho}>
                <Ionicons name="add-circle-outline" size={22} color="#2E7D32" />
                <Text style={styles.btnAdicionarFilhoTexto}>ADICIONAR OUTRO FILHO</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnLogin} onPress={handleSalvarFilhos}>
                <Text style={styles.btnLoginText}>SALVAR E CONTINUAR</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnVoltar}
                onPress={() =>
                  concluirCadastroFilhos(
                    editandoFilhosPeloPerfil
                      ? 'perfil'
                      : cadastrouMaeAtipica
                      ? 'bem_vindo_mae'
                      : 'inicio'
                  )
                }
              >
                <Text style={styles.btnVoltarText}>
                  {editandoFilhosPeloPerfil ? '← Voltar ao perfil' : 'Pular por agora'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  // TELA 3: HOME / BEM-VINDO! / PERFIL / PROFISSIONAIS / PROFISSIONAIS SALVOS / ADICIONAR PROFISSIONAIS / AVALIAR PROFISSIONAL / DETALHE PROFISSIONAL
  const nomeExibicao = (
    nome ||
    auth.currentUser?.displayName ||
    (auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : '') ||
    'MARIA'
  ).toUpperCase();

  const filhosCadastrados = filhos.filter((f) => (f.nome || '').trim().length > 0);

  const resumoFilhos = (() => {
    const validos = filhos.filter(
      (f) =>
        (f.nome || '').trim() ||
        (f.dificuldades && f.dificuldades.length > 0) ||
        (f.outraDificuldade || '').trim()
    );
    if (validos.length === 0) return 'FILHO, TEA';

    return validos
      .map((f) => {
        const tags = [...(f.dificuldades || [])];
        if ((f.outraDificuldade || '').trim()) tags.push(f.outraDificuldade.trim().toUpperCase());
        const sufixo = tags.length > 0 ? tags.join(', ') : 'FILHO(A)';
        return (f.nome || '').trim() ? `${f.nome.trim().toUpperCase()} (${sufixo})` : sufixo;
      })
      .join(' • ');
  })();

  const abrirOpcaoPerfil = (titulo, mensagem) => {
    Alert.alert(titulo, mensagem);
  };

  const maeEstaOnline = Boolean(auth.currentUser) || cadastrouMaeAtipica;
  const mostrarContadorMaesOnline = maeEstaOnline && maesOnline > 0;
  const mostrarTelaBemVindoMae =
    mostrarContadorMaesOnline && (abaHome === 'bem_vindo_mae' || abaHome === 'inicio');
  const naSecaoProfissional =
    abaHome === 'lista_profissionais' ||
    abaHome === 'profissionais' ||
    abaHome === 'adicionar_profissional' ||
    abaHome === 'avaliar_profissional' ||
    abaHome === 'detalhe_profissional';

  const termoBuscaNormalizado = buscaProfissional.trim().toUpperCase();
  const profissionaisFiltrados = profissionais.filter((prof) => {
    const matchesTag =
      !filtroTagProfissional ||
      (Array.isArray(prof.tags) && prof.tags.includes(filtroTagProfissional));

    if (!matchesTag) return false;
    if (!termoBuscaNormalizado) return true;

    const camposTexto = [
      prof.nome,
      prof.especialidade,
      prof.cidade,
      prof.sobre,
      ...(Array.isArray(prof.tags) ? prof.tags : []),
      ...(Array.isArray(prof.relatos) ? prof.relatos : []),
    ]
      .join(' ')
      .toUpperCase();

    return camposTexto.includes(termoBuscaNormalizado);
  });

  const profissionalAvaliadoAtual =
    profissionais.find((p) => p.id === profissionalEmAvaliacaoId) ||
    profissionalEmDetalhe || {
      id: 'avaliacao-preview',
      nome: 'DRA ANA PAULA',
      especialidade: 'PSICÓLOGA',
      cidade: 'RECIFE-PE',
      sobre: 'Atendimento acolhedor com experiência em TEA e Desenvolvimento Infantil',
      coracoes: 5,
      relatos: ['ACOLHEDORA'],
    };

  const detalheAtual =
    profissionalEmDetalhe ||
    profissionais[0] || {
      id: 'preview',
      nome: 'DRA ANA PAULA',
      especialidade: 'PSICOLOGA',
      cidade: 'RECIFE-PE',
      sobre: 'Atendimento acolhedor com experiência em TEA e Desenvolvimento Infantil',
      coracoes: 5,
      relatos: ['ACOLHEDORA', 'PACIENTE', 'HUMANIZADA'],
    };

  const relatosSelecionadosDetalhe = Array.isArray(detalheAtual.relatos)
    ? detalheAtual.relatos
    : ['ACOLHEDORA'];

  const listaRelatosExibida = Array.from(
    new Set([...RELATOS_PADRAO, ...relatosSelecionadosDetalhe])
  );

  const notaCoracoesDetalhe =
    typeof detalheAtual.coracoes === 'number' ? detalheAtual.coracoes : 5;

  const destaqueRelatoCabecalho =
    relatosSelecionadosDetalhe[0] || 'ACOLHEDORA';

  return (
    <SafeAreaView style={styles.containerHome}>
      {/* Cabeçalho */}
      <View style={styles.headerHome}>
        <TouchableOpacity
          onPress={() => {
            if (abaHome === 'detalhe_profissional') {
              setAbaHome(abaAnteriorProfissional || 'lista_profissionais');
            } else if (abaHome === 'avaliar_profissional') {
              setAbaHome('adicionar_profissional');
            } else {
              Alert.alert(
                'Menu Bemvi',
                `Você está em: ${abaHome.toUpperCase()}${
                  modoAnonimo ? ' (Modo Anônimo ativo)' : ''
                }`
              );
            }
          }}
        >
          <Ionicons
            name={
              abaHome === 'detalhe_profissional' || abaHome === 'avaliar_profissional'
                ? 'arrow-back'
                : 'menu-outline'
            }
            size={28}
            color="#111"
          />
        </TouchableOpacity>

        {abaHome === 'inicio' && !cadastrouMaeAtipica && (
          <Text style={styles.logoTextHome}>Bemvi</Text>
        )}

        <View style={styles.headerRightGroup}>
          {!cadastrouMaeAtipica && (
            <TouchableOpacity
              onPress={handleLogout}
              style={styles.btnSairTopo}
              disabled={enviandoAuth || excluindoPerfil}
            >
              <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() =>
              Alert.alert('Notificações', 'Nenhuma nova notificação no momento.')
            }
          >
            <Ionicons name="notifications" size={26} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      {abaHome === 'avaliar_profissional' ? (
        // TELA AVALIAR PROFISSIONAL (1 A 5 CORAÇÕES VERMELHOS)
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollProfissionais}
            contentContainerStyle={styles.contentAvaliarProfissional}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerVoltarProfissional}>
              <TouchableOpacity
                onPress={() => setAbaHome('adicionar_profissional')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={26} color="#111" />
              </TouchableOpacity>
              <Text style={styles.tituloAvaliarProfissional}>AVALIAR PROFISSIONAL</Text>
            </View>

            <View style={styles.cartaoResumoAvaliacao}>
              <View style={styles.iconeProfissionalEsquerda}>
                <Ionicons name="person" size={54} color="#000" />
                <View style={styles.badgeFolhaProfissional} />
              </View>
              <View style={styles.infoResumoAvaliacao}>
                <Text style={styles.textoResumoAvaliacao}>
                  {(profissionalAvaliadoAtual.nome || '').toUpperCase()}
                </Text>
                <Text style={styles.textoResumoAvaliacao}>
                  {(profissionalAvaliadoAtual.especialidade || '').toUpperCase()} ·{' '}
                  {(profissionalAvaliadoAtual.cidade || '').toUpperCase()}
                </Text>
                <Text style={styles.textoResumoAvaliacao}>
                  {(
                    (Array.isArray(profissionalAvaliadoAtual.relatos) &&
                      profissionalAvaliadoAtual.relatos[0]) ||
                    'ACOLHEDORA'
                  ).toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.tituloExperienciaAvaliacao}>COMO FOI SUA EXPERIÊNCIA?</Text>
            <Text style={styles.subtituloCoracoesAvaliacao}>
              TOQUE NOS CORAÇÕES PARA AVALIAR
            </Text>

            <View style={styles.linhaCoracoesAvaliacao}>
              {[1, 2, 3, 4, 5].map((nivel) => {
                const ativo = nivel <= coracoesAvaliacao;
                return (
                  <TouchableOpacity
                    key={nivel}
                    onPress={() => setCoracoesAvaliacao(nivel)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    accessibilityLabel={`Avaliar com ${nivel} ${
                      nivel === 1 ? 'coração' : 'corações'
                    }`}
                  >
                    <Ionicons
                      name={ativo ? 'heart' : 'heart-outline'}
                      size={40}
                      color={ativo ? COR_CORACAO_VERMELHO : '#9CA3AF'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.tituloDestaqueAvaliacao}>O QUE MAIS SE DESTACOU?</Text>
            <View style={styles.gradeDestaquesAvaliacao}>
              {DESTAQUES_AVALIACAO.map((tag) => {
                const selecionado = destaquesAvaliacao.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.pilulaDestaqueAvaliacao,
                      selecionado
                        ? styles.pilulaDestaqueAtiva
                        : styles.pilulaDestaqueInativa,
                    ]}
                    onPress={() => alternarDestaqueAvaliacao(tag)}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.textoPilulaDestaque}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.labelRelatoAvaliacao}>SEU RELATO</Text>
            <View style={styles.caixaRelatoAvaliacao}>
              <TextInput
                style={styles.inputRelatoAvaliacao}
                placeholder="Conte como foi o atendimento e o que outras mães deveriam saber."
                placeholderTextColor="#222"
                value={relatoAvaliacao}
                onChangeText={(texto) => setRelatoAvaliacao(texto.slice(0, 200))}
                multiline
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.contadorRelatoAvaliacao}>
                {relatoAvaliacao.length}/200
              </Text>
            </View>
            <Text style={styles.ajudaRelatoAvaliacao}>
              Seu relato ajuda outras mães a encontrarem acolhimento.
            </Text>

            <TouchableOpacity
              style={styles.btnConcluirIndicacao}
              onPress={handleConcluirIndicacao}
              activeOpacity={0.85}
            >
              <Text style={styles.btnConcluirIndicacaoTexto}>CONCLUIR INDICAÇÃO</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : abaHome === 'detalhe_profissional' ? (
        // TELA DETALHE PROFISSIONAL
        <ScrollView
          style={styles.scrollProfissionais}
          contentContainerStyle={styles.contentDetalheProfissional}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topoDetalheProfissional}>
            <View style={styles.iconeProfissionalEsquerda}>
              <Ionicons name="person" size={62} color="#000" />
              <View style={styles.badgeFolhaDetalhe} />
            </View>

            <View style={styles.balaoDetalheProfissional}>
              <Text style={styles.textoBalaoDetalhe}>
                {(detalheAtual.nome || '').toUpperCase()}
              </Text>
              <Text style={styles.textoBalaoDetalhe}>
                {(detalheAtual.especialidade || '').toUpperCase()}
              </Text>
              <Text style={styles.textoBalaoDetalhe}>
                {(detalheAtual.cidade || '').toUpperCase()}
              </Text>
              <Text style={styles.textoBalaoDetalhe}>
                {destaqueRelatoCabecalho.toUpperCase()}
              </Text>

              <View style={styles.linhaCoracoesDetalhe}>
                {[1, 2, 3, 4, 5].map((nivel) => (
                  <TouchableOpacity
                    key={nivel}
                    onPress={() => {
                      setProfissionalEmDetalhe((prev) =>
                        prev ? { ...prev, coracoes: nivel } : prev
                      );
                      handleAvaliarCoracoesProfissional(detalheAtual.id, nivel);
                    }}
                    hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                  >
                    <Ionicons
                      name={nivel <= notaCoracoesDetalhe ? 'heart' : 'heart-outline'}
                      size={19}
                      color={
                        nivel <= notaCoracoesDetalhe ? COR_CORACAO_VERMELHO : '#9CA3AF'
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.blocoSobreDetalhe}>
            <Text style={styles.tituloSobreDetalhe}>Sobre</Text>
            <Text style={styles.textoSobreDetalhe}>
              {detalheAtual.sobre ||
                'Atendimento acolhedor com experiência em TEA e Desenvolvimento Infantil'}
            </Text>
          </View>

          <View style={styles.secaoRelatosDetalhe}>
            <View style={styles.relatosHeaderRow}>
              <Text style={styles.tituloRelatosDetalhe}>Relatos</Text>
              <TouchableOpacity
                onPress={() => setMostrarInputRelatoExtra((prev) => !prev)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.linkAdicionarRelato}>+ relato</Text>
              </TouchableOpacity>
            </View>

            {mostrarInputRelatoExtra && (
              <View style={styles.linhaNovoRelato}>
                <TextInput
                  style={styles.inputNovoRelato}
                  placeholder="Ex.: ATENCIOSA"
                  placeholderTextColor="#666"
                  value={relatoExtraInput}
                  onChangeText={setRelatoExtraInput}
                  autoCapitalize="characters"
                />
                <TouchableOpacity
                  style={styles.btnConfirmarRelato}
                  onPress={adicionarRelatoExtraDetalhe}
                >
                  <Text style={styles.btnConfirmarRelatoTexto}>OK</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.pilulasRelatosColuna}>
              {listaRelatosExibida.map((relato) => {
                const selecionado = relatosSelecionadosDetalhe.includes(relato);
                return (
                  <TouchableOpacity
                    key={relato}
                    style={[
                      styles.pilulaRelatoAzul,
                      !selecionado && styles.pilulaRelatoInativa,
                    ]}
                    onPress={() => alternarRelatoDetalhe(relato)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.textoPilulaRelato}>{relato}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.acoesDetalheRow}>
            <TouchableOpacity
              style={styles.btnSalvarDetalhe}
              onPress={handleSalvarDetalheProfissional}
            >
              <Text style={styles.btnSalvarDetalheTexto}>SALVAR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnCompartilharDetalhe}
              onPress={() => handleCompartilharProfissional(detalheAtual)}
            >
              <Text style={styles.btnCompartilharDetalheTexto}>COMPARTILHAR</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : abaHome === 'lista_profissionais' ? (
        // TELA PROFISSIONAIS (EXIBE APENAS PROFISSIONAIS SALVOS COM BUSCA, FILTROS E AÇÕES)
        <ScrollView
          style={styles.scrollProfissionais}
          contentContainerStyle={styles.contentListaProfissionais}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topoListaProfissionais}>
            <TouchableOpacity
              onPress={() =>
                setAbaHome(cadastrouMaeAtipica ? 'bem_vindo_mae' : 'inicio')
              }
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={26} color="#111" />
            </TouchableOpacity>
            <Text style={styles.tituloListaProfissionais}>PROFISSIONAIS</Text>
          </View>

          <View style={styles.barraBuscaProfissionais}>
            <Ionicons name="search" size={22} color="#111" />
            <TextInput
              style={styles.inputBuscaProfissionais}
              placeholder="BUSCAR"
              placeholderTextColor="#111"
              value={buscaProfissional}
              onChangeText={setBuscaProfissional}
            />
            {buscaProfissional.length > 0 && (
              <TouchableOpacity onPress={() => setBuscaProfissional('')}>
                <Ionicons name="close-circle" size={20} color="#111" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.linhaFiltrosProfissionais}>
            {FILTROS_PROFISSIONAIS.map((tag) => {
              const ativo = filtroTagProfissional === tag;
              let estiloBase = styles.filtroTea;
              if (tag === 'TDAH') estiloBase = styles.filtroTdah;
              if (tag === 'TOD') estiloBase = styles.filtroTod;

              return (
                <TouchableOpacity
                  key={tag}
                  style={[
                    styles.pilulaFiltroProfissional,
                    estiloBase,
                    ativo && styles.filtroProfissionalSelecionado,
                  ]}
                  onPress={() =>
                    setFiltroTagProfissional((prev) => (prev === tag ? '' : tag))
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.textoFiltroProfissional}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {profissionaisFiltrados.length === 0 ? (
            <View style={styles.cartaoVazioProfissional}>
              <Text style={styles.textoVazioProfissional}>
                {profissionais.length === 0
                  ? 'Nenhum profissional salvo ainda. Toque em ADICIONAR INDICAÇÕES para cadastrar e salvar.'
                  : 'Nenhum profissional salvo encontrado com esse filtro ou busca.'}
              </Text>
            </View>
          ) : (
            profissionaisFiltrados.map((prof) => {
              const notaCoracoes =
                typeof prof.coracoes === 'number' ? prof.coracoes : 5;
              const destaqueCard =
                (Array.isArray(prof.relatos) && prof.relatos[0]) ||
                prof.sobre ||
                '';

              return (
                <View key={prof.id} style={styles.blocoProfissionalCatalogo}>
                  <View style={styles.linhaProfissionalCatalogo}>
                    <View style={styles.iconeProfissionalEsquerda}>
                      <Ionicons name="person" size={56} color="#000" />
                      <View style={styles.badgeFolhaProfissional} />
                    </View>

                    <View style={styles.balaoCinzaProfissional}>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.nome || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.especialidade || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.cidade || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {destaqueCard.toUpperCase()}
                      </Text>

                      <View style={styles.linhaCoracoesProfissional}>
                        {[1, 2, 3, 4, 5].map((nivel) => (
                          <TouchableOpacity
                            key={nivel}
                            onPress={() =>
                              handleAvaliarCoracoesProfissional(prof.id, nivel)
                            }
                            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                          >
                            <Ionicons
                              name={nivel <= notaCoracoes ? 'heart' : 'heart-outline'}
                              size={18}
                              color={
                                nivel <= notaCoracoes
                                  ? COR_CORACAO_VERMELHO
                                  : '#9CA3AF'
                              }
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSetaDetalheProfissional}
                      onPress={() =>
                        abrirDetalheProfissional(prof, 'lista_profissionais')
                      }
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Ver detalhe do profissional"
                    >
                      <Ionicons name="arrow-forward" size={24} color="#111" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.btnExcluirProfissionalSalvo}
                    onPress={() => handleExcluirProfissionalSalvo(prof)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnExcluirProfissionalSalvoTexto}>EXCLUIR</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.btnSalvosListaProfissionais}
            onPress={() => setAbaHome('profissionais')}
            activeOpacity={0.85}
          >
            <Text style={styles.btnSalvosListaProfissionaisTexto}>
              SALVOS{profissionais.length > 0 ? ` (${profissionais.length})` : ''}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAdicionarIndicacoesLista}
            onPress={() => {
              limparFormularioProfissional();
              setAbaHome('adicionar_profissional');
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.btnAdicionarIndicacoesListaTexto}>
              ADICIONAR INDICAÇÕES
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : abaHome === 'adicionar_profissional' ? (
        // TELA ADICIONAR PROFISSIONAIS
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={styles.scrollProfissionais}
            contentContainerStyle={styles.contentProfissionais}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerVoltarProfissional}>
              <TouchableOpacity
                onPress={() => {
                  setErroCadastroProfissional('');
                  setAbaHome('lista_profissionais');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="arrow-back" size={26} color="#111" />
              </TouchableOpacity>
              <Text style={styles.tituloAdicionarProfissionais}>
                ADICIONAR PROFISSIONAIS
              </Text>
            </View>

            <View style={styles.campoProfissionalBox}>
              <Text style={styles.labelProfissional}>NOME DO PROFISSIONAL</Text>
              <TextInput
                style={styles.inputProfissionalCinza}
                placeholder="Ex. Dra Ana Paula"
                placeholderTextColor="#555"
                value={nomeProfissional}
                onChangeText={(texto) => {
                  setNomeProfissional(texto);
                  if (erroCadastroProfissional) setErroCadastroProfissional('');
                }}
              />
            </View>

            <View style={styles.campoProfissionalBox}>
              <Text style={styles.labelProfissional}>ESPECIALIDADE</Text>
              <TouchableOpacity
                style={styles.seletorEspecialidadeCinza}
                onPress={() => setMostrarOpcoesEspecialidade((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.textoSeletorEspecialidade,
                    especialidadeProfissional && styles.textoSeletorSelecionado,
                  ]}
                >
                  {especialidadeProfissional
                    ? especialidadeProfissional.toUpperCase()
                    : 'SELECIONE'}
                </Text>
                <Ionicons
                  name={mostrarOpcoesEspecialidade ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#222"
                />
              </TouchableOpacity>

              {mostrarOpcoesEspecialidade && (
                <View style={styles.opcoesEspecialidadeLista}>
                  {OPCOES_ESPECIALIDADE.map((item) => {
                    const ativa = especialidadeProfissional === item;
                    return (
                      <TouchableOpacity
                        key={item}
                        style={[
                          styles.opcaoEspecialidadeItem,
                          ativa && styles.opcaoEspecialidadeAtiva,
                        ]}
                        onPress={() => {
                          setEspecialidadeProfissional(item);
                          if (item !== 'Outros') {
                            setOutraEspecialidadeProfissional('');
                          }
                          setMostrarOpcoesEspecialidade(false);
                          if (erroCadastroProfissional) setErroCadastroProfissional('');
                        }}
                      >
                        <Text
                          style={[
                            styles.opcaoEspecialidadeTexto,
                            ativa && styles.opcaoEspecialidadeTextoAtivo,
                          ]}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {especialidadeProfissional === 'Outros' && (
                <TextInput
                  style={[styles.inputProfissionalCinza, styles.inputOutraEspecialidade]}
                  placeholder="Digite a especialidade"
                  placeholderTextColor="#555"
                  value={outraEspecialidadeProfissional}
                  onChangeText={(texto) => {
                    setOutraEspecialidadeProfissional(texto);
                    if (erroCadastroProfissional) setErroCadastroProfissional('');
                  }}
                />
              )}
            </View>

            <View style={styles.campoProfissionalBox}>
              <Text style={styles.labelProfissional}>CIDADE</Text>
              <TextInput
                style={styles.inputProfissionalCinza}
                placeholder="RECIFE-PE"
                placeholderTextColor="#555"
                value={cidadeProfissional}
                onChangeText={(texto) => {
                  setCidadeProfissional(texto);
                  if (erroCadastroProfissional) setErroCadastroProfissional('');
                }}
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.campoProfissionalBox}>
              <Text style={styles.labelProfissional}>SOBRE O PROFISSIONAL</Text>
              <View style={styles.areaSobreCinza}>
                <TextInput
                  style={styles.inputSobreMultiline}
                  placeholder="FALE SOBRE SUA EXPERIÊNCIA"
                  placeholderTextColor="#444"
                  value={sobreProfissional}
                  onChangeText={(texto) => {
                    setSobreProfissional(texto.slice(0, 200));
                    if (erroCadastroProfissional) setErroCadastroProfissional('');
                  }}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
                <Text style={styles.contadorCaracteres}>
                  {sobreProfissional.length}/200
                </Text>
              </View>
            </View>

            {erroCadastroProfissional ? (
              <Text style={styles.erroProfissionalTexto}>{erroCadastroProfissional}</Text>
            ) : null}

            <TouchableOpacity
              style={[
                styles.btnProximoProfissional,
                salvandoProfissional && styles.btnDesabilitado,
              ]}
              onPress={handleProximoProfissional}
              disabled={salvandoProfissional}
            >
              <Text style={styles.btnProximoProfissionalTexto}>
                {salvandoProfissional ? 'SALVANDO...' : 'PRÓXIMO'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : abaHome === 'profissionais' ? (
        // TELA PROFISSIONAIS SALVOS
        <ScrollView
          style={styles.scrollProfissionais}
          contentContainerStyle={styles.contentProfissionaisSalvos}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerVoltarProfissional}>
            <TouchableOpacity
              onPress={() => setAbaHome('lista_profissionais')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={26} color="#111" />
            </TouchableOpacity>
            <Text style={styles.tituloProfissionaisSalvos}>
              {'PROFISSIONAIS\nSALVOS'}
            </Text>
          </View>

          {profissionais.length === 0 ? (
            <View style={styles.cartaoVazioProfissional}>
              <Text style={styles.textoVazioProfissional}>
                Nenhum profissional salvo ainda. Toque abaixo para adicionar.
              </Text>
            </View>
          ) : (
            profissionais.map((prof) => {
              const notaCoracoes =
                typeof prof.coracoes === 'number' ? prof.coracoes : 5;

              return (
                <View key={prof.id} style={styles.blocoProfissionalSalvoItem}>
                  <View style={styles.linhaProfissionalSalvo}>
                    <View style={styles.iconeProfissionalEsquerda}>
                      <Ionicons name="person" size={54} color="#000" />
                      <View style={styles.badgeFolhaProfissional} />
                    </View>

                    <View style={styles.balaoCinzaProfissional}>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.nome || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.especialidade || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.cidade || '').toUpperCase()}
                      </Text>
                      <Text style={styles.textoBalaoProfissional}>
                        {(prof.sobre || '').toUpperCase()}
                      </Text>

                      <View style={styles.linhaCoracoesProfissional}>
                        {[1, 2, 3, 4, 5].map((nivel) => (
                          <TouchableOpacity
                            key={nivel}
                            onPress={() =>
                              handleAvaliarCoracoesProfissional(prof.id, nivel)
                            }
                            hitSlop={{ top: 6, bottom: 6, left: 3, right: 3 }}
                          >
                            <Ionicons
                              name={nivel <= notaCoracoes ? 'heart' : 'heart-outline'}
                              size={18}
                              color={
                                nivel <= notaCoracoes
                                  ? COR_CORACAO_VERMELHO
                                  : '#9CA3AF'
                              }
                            />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <TouchableOpacity
                      style={styles.btnSetaDetalheProfissional}
                      onPress={() => abrirDetalheProfissional(prof, 'profissionais')}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityLabel="Ver detalhe do profissional"
                    >
                      <Ionicons name="arrow-forward" size={24} color="#111" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.btnExcluirProfissionalSalvo}
                    onPress={() => handleExcluirProfissionalSalvo(prof)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnExcluirProfissionalSalvoTexto}>EXCLUIR</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

          <TouchableOpacity
            style={styles.btnAdicionarMaisProfissional}
            onPress={() => {
              limparFormularioProfissional();
              setAbaHome('adicionar_profissional');
            }}
          >
            <Ionicons name="add-circle-outline" size={20} color="#111" />
            <Text style={styles.btnAdicionarMaisProfissionalTexto}>
              ADICIONAR PROFISSIONAL
            </Text>
          </TouchableOpacity>
        </ScrollView>
      ) : abaHome === 'perfil' ? (
        <ScrollView
          style={styles.scrollPerfil}
          contentContainerStyle={styles.contentPerfil}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.perfilHeaderCard}>
            <View style={styles.avatarCirculo}>
              <Ionicons
                name={modoAnonimo ? 'eye-off' : 'person'}
                size={44}
                color="#111"
              />
            </View>
            <View style={styles.perfilSaudacaoBox}>
              <Text style={styles.perfilSaudacaoTexto}>
                OLÁ! {modoAnonimo ? 'ANÔNIMA' : nomeExibicao}
              </Text>
              {email ? (
                <Text style={styles.perfilEmailTexto}>{email}</Text>
              ) : null}
              {modoAnonimo && (
                <Text style={styles.perfilSubAnonimo}>
                  Identidade ocultada na comunidade
                </Text>
              )}
              <TouchableOpacity
                style={styles.btnCorrigirMae}
                onPress={abrirCorrecaoMae}
              >
                <Ionicons name="create-outline" size={16} color="#3E5C5B" />
                <Text style={styles.btnCorrigirMaeTexto}>Corrigir meu cadastro</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.faixaFilhoEditar}>
            <Text style={styles.faixaFilhoTexto} numberOfLines={2}>
              {resumoFilhos}
            </Text>
            <TouchableOpacity
              onPress={() => abrirEdicaoFilhos(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.faixaEditarTexto}>EDITAR</Text>
            </TouchableOpacity>
          </View>

          {/* Filhos salvos consultados no Perfil */}
          <View style={styles.blocoFilhosPerfil}>
            <Text style={styles.blocoFilhosTitulo}>FILHOS CADASTRADOS</Text>
            {filhosCadastrados.length === 0 ? (
              <Text style={styles.semFilhosTexto}>
                Nenhum filho salvo ainda. Toque em EDITAR para adicionar.
              </Text>
            ) : (
              filhosCadastrados.map((f) => {
                const tags = [...(f.dificuldades || [])];
                if ((f.outraDificuldade || '').trim()) tags.push(f.outraDificuldade.trim());
                const idadeTexto = f.idade || calcularIdadeDeDataBR(f.dataNascimento || '');
                const detalhe = [
                  idadeTexto,
                  f.dataNascimento ? `Nasc.: ${f.dataNascimento}` : '',
                ]
                  .filter(Boolean)
                  .join(' • ');

                return (
                  <View key={f.id} style={styles.cartaoFilhoPerfil}>
                    <Text style={styles.cartaoFilhoNome}>{f.nome}</Text>
                    {detalhe ? (
                      <Text style={styles.cartaoFilhoDetalhe}>{detalhe}</Text>
                    ) : null}
                    {tags.length > 0 && (
                      <Text style={styles.cartaoFilhoTags}>{tags.join(', ')}</Text>
                    )}
                  </View>
                );
              })
            )}
          </View>

          <View style={styles.listaPerfilContainer}>
            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'HISTÓRICO',
                  'Visualize suas interações, consultas e atividades recentes na plataforma.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>HISTÓRICO</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'PREFERÊNCIA',
                  'Personalize suas preferências de rede de apoio, temas e alertas.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>PREFERÊNCIA</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'ACESSIBILIDADE',
                  'Ajuste recursos de acessibilidade para facilitar seu uso diário.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>ACESSIBILIDADE</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <View style={styles.itemPerfil}>
              <Text style={styles.itemPerfilTexto}>ANÔNIMO</Text>
              <Switch
                value={modoAnonimo}
                onValueChange={handleAlternarAnonimo}
                trackColor={{ false: '#D1D5DB', true: '#111' }}
                thumbColor={modoAnonimo ? '#FFF' : '#111'}
              />
            </View>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'AJUDA',
                  'Acesse orientações de uso e canais de apoio da equipe Bemvi.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>AJUDA</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.itemPerfil}
              onPress={() =>
                abrirOpcaoPerfil(
                  'SOBRE',
                  'Bemvi — Plataforma de acolhimento, conexão e indicação para mães atípicas.'
                )
              }
            >
              <Text style={styles.itemPerfilTexto}>SOBRE</Text>
              <Ionicons name="arrow-forward" size={26} color="#111" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSairPerfil}
              onPress={handleLogout}
              disabled={enviandoAuth || excluindoPerfil}
            >
              <Ionicons name="log-out-outline" size={20} color="#B91C1C" />
              <Text style={styles.btnSairPerfilTexto}>
                {enviandoAuth ? 'SAINDO...' : 'SAIR DA CONTA'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnExcluirPerfil, excluindoPerfil && styles.btnDesabilitado]}
              onPress={() => setPedirConfirmacaoExclusao((prev) => !prev)}
              disabled={excluindoPerfil || enviandoAuth}
            >
              <Ionicons name="trash-outline" size={20} color="#FFF" />
              <Text style={styles.btnExcluirPerfilTexto}>
                {excluindoPerfil ? 'EXCLUINDO PERFIL...' : 'EXCLUIR PERFIL'}
              </Text>
            </TouchableOpacity>

            {pedirConfirmacaoExclusao && (
              <View style={styles.caixaConfirmacaoExclusao}>
                <Text style={styles.tituloConfirmacaoExclusao}>
                  Confirmar exclusão permanente?
                </Text>
                <Text style={styles.textoConfirmacaoExclusao}>
                  Isso removerá seu perfil e os dados dos filhos cadastrados.
                </Text>
                <View style={styles.botoesConfirmacaoRow}>
                  <TouchableOpacity
                    style={styles.btnCancelarExclusao}
                    onPress={() => setPedirConfirmacaoExclusao(false)}
                  >
                    <Text style={styles.btnCancelarExclusaoTexto}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.btnConfirmarExclusao}
                    onPress={executarExclusaoPerfil}
                  >
                    <Text style={styles.btnConfirmarExclusaoTexto}>Sim, excluir</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      ) : mostrarTelaBemVindoMae ? (
        // TELA "BEM-VINDO!" (EXIBE CONTAGEM QUANDO HÁ MÃES ONLINE)
        <ScrollView
          style={styles.scrollBemVindo}
          contentContainerStyle={styles.contentBemVindo}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.tituloSejaBemVinda}>SEJA BEM VINDA!</Text>

          {mostrarContadorMaesOnline && (
            <View style={styles.maesOnlineRow}>
              <Text style={styles.maesOnlineTexto}>Mães Online</Text>
              <View style={styles.bolinhaOnline} />
              <Text style={styles.maesOnlineNumero}>{maesOnline}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.btnAcaoAzul}
            onPress={() => setAbaHome('apoio')}
          >
            <Text style={styles.btnAcaoTexto}>PRECISO CONVERSAR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAcaoVerde}
            onPress={() => setAbaHome('lista_profissionais')}
          >
            <Text style={styles.btnAcaoTexto}>ENCONTRAR PROFISSIONAL</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAcaoOuro}
            onPress={() => setAbaHome('mapa')}
          >
            <Text style={styles.btnAcaoTexto}>MAPA INCLUSIVO</Text>
          </TouchableOpacity>

          <View style={styles.acessoRapidoBox}>
            <Text style={styles.acessoRapidoTitulo}>ACESSO RÁPIDO</Text>
            <View style={styles.acessoRapidoGrid}>
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Favoritos', 'Atalho de favoritos.')}
              />
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Agenda', 'Atalho da agenda.')}
              />
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Guias', 'Atalho de guias.')}
              />
            </View>
          </View>
        </ScrollView>
      ) : (
        // TELA "HOME"
        <ScrollView
          style={styles.scrollHome}
          contentContainerStyle={styles.contentHome}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.subtitleHome}>Você não está sozinha.</Text>

          <View style={styles.espacoSuperiorHome} />

          <TouchableOpacity
            style={styles.btnAcaoAzul}
            onPress={() => setAbaHome('apoio')}
          >
            <Text style={styles.btnAcaoTexto}>PRECISO CONVERSAR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnHomeVerdeClaro}
            onPress={() => setAbaHome('lista_profissionais')}
          >
            <Text style={styles.btnAcaoTexto}>ENCONTRAR PROFISSIONAIS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnHomeAmareloClaro}
            onPress={() => setAbaHome('mapa')}
          >
            <Text style={styles.btnAcaoTexto}>MAPA INCLUSIVO</Text>
          </TouchableOpacity>

          <View style={styles.acessoRapidoBox}>
            <Text style={styles.acessoRapidoTitulo}>ACESSO RÁPIDO</Text>
            <View style={styles.acessoRapidoGrid}>
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Favoritos', 'Atalho de favoritos.')}
              />
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Agenda', 'Atalho da agenda.')}
              />
              <TouchableOpacity
                style={styles.quadradoAcessoRapido}
                onPress={() => Alert.alert('Guias', 'Atalho de guias.')}
              />
            </View>
          </View>
        </ScrollView>
      )}

      {/* Barra de Ícones Fixa no Fim da Tela */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome(cadastrouMaeAtipica ? 'bem_vindo_mae' : 'inicio')}
        >
          <Ionicons
            name="home"
            size={24}
            color={
              abaHome === 'inicio' || abaHome === 'bem_vindo_mae' ? '#16A34A' : '#111'
            }
          />
          <Text
            style={[
              styles.tabText,
              (abaHome === 'inicio' || abaHome === 'bem_vindo_mae') &&
                styles.tabTextAtivo,
            ]}
          >
            Inicio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('apoio')}
        >
          <Ionicons
            name="heart"
            size={24}
            color={abaHome === 'apoio' ? '#16A34A' : '#111'}
          />
          <Text style={[styles.tabText, abaHome === 'apoio' && styles.tabTextAtivo]}>
            Apoio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('lista_profissionais')}
        >
          <Ionicons
            name="briefcase"
            size={24}
            color={naSecaoProfissional ? '#16A34A' : '#111'}
          />
          <Text style={[styles.tabText, naSecaoProfissional && styles.tabTextAtivo]}>
            Profissional
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('mapa')}
        >
          <Ionicons
            name="location"
            size={24}
            color={abaHome === 'mapa' ? '#16A34A' : '#111'}
          />
          <Text style={[styles.tabText, abaHome === 'mapa' && styles.tabTextAtivo]}>
            Mapa
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setAbaHome('perfil')}
        >
          <Ionicons
            name="person"
            size={24}
            color={abaHome === 'perfil' ? '#16A34A' : '#111'}
          />
          <Text style={[styles.tabText, abaHome === 'perfil' && styles.tabTextAtivo]}>
            Perfil
          </Text>
        </TouchableOpacity>
      </View>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  containerWelcome: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  imageContainer: {
    alignItems: 'center',
  },

  logo: {
    width: 280,
    height: 280,
    resizeMode: 'contain',
  },

  textContainerWelcome: {
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 600,
    width: '100%',
  },

  textoAcolhimento: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3E5C5B',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.5,
  },

  btnSeta: {
    backgroundColor: '#000',
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },

  containerLogin: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  containerFilhos: {
    flex: 1,
    backgroundColor: '#F5F5DC',
    paddingHorizontal: 20,
  },

  scrollCadastro: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },

  scrollFilhos: {
    flexGrow: 1,
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 36,
  },

  loginContent: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },

  loginTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E5C5B',
    marginBottom: 8,
  },

  loginSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },

  caixaAvisoNaoCadastrado: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    gap: 6,
  },

  textoAvisoNaoCadastrado: {
    fontSize: 13,
    fontWeight: '600',
    color: '#991B1B',
  },

  linkCriarContaAviso: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E7D32',
  },

  cardFilho: {
    backgroundColor: '#EFECE2',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },

  cardFilhoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  cardFilhoTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3E5C5B',
  },

  btnRemoverFilho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  textoRemoverFilho: {
    fontSize: 13,
    color: '#B91C1C',
    fontWeight: '600',
  },

  linhaDataIdade: {
    flexDirection: 'row',
    gap: 10,
  },

  colunaData: {
    flex: 1.4,
  },

  colunaIdade: {
    flex: 1,
  },

  inputContainer: {
    marginBottom: 14,
    width: '100%',
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E5C5B',
    marginBottom: 6,
  },

  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#333',
  },

  inputSenhaWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D8D2C6',
    borderRadius: 12,
  },

  inputSenha: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },

  btnOlho: {
    paddingHorizontal: 14,
  },

  tiposContainer: {
    marginBottom: 14,
    width: '100%',
  },

  chipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },

  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3E5C5B',
    backgroundColor: '#FFF',
  },

  chipAtivo: {
    backgroundColor: '#2E7D32',
    borderColor: '#2E7D32',
  },

  chipTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3E5C5B',
  },

  chipTextoAtivo: {
    color: '#FFF',
  },

  btnAdicionarFilho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 13,
    backgroundColor: '#FFF',
    marginBottom: 10,
  },

  btnAdicionarFilhoTexto: {
    color: '#2E7D32',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.4,
  },

  btnLogin: {
    backgroundColor: '#3E5C5B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },

  btnDesabilitado: {
    opacity: 0.65,
  },

  btnLoginText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.8,
  },

  textoPergunta: {
    textAlign: 'center',
    color: '#3E5C5B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 8,
  },

  btnVerdeDestaque: {
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },

  btnVerdeDestaqueText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  btnVoltar: {
    marginTop: 18,
    alignItems: 'center',
    paddingVertical: 8,
  },

  btnVoltarText: {
    color: '#3E5C5B',
    fontSize: 15,
    fontWeight: '600',
  },

  containerHome: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  headerHome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 45 : 15,
    paddingBottom: 10,
    backgroundColor: '#FFF',
  },

  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  btnSairTopo: {
    padding: 4,
  },

  logoTextHome: {
    fontSize: 28,
    fontWeight: '400',
    color: '#111',
  },

  // TELA AVALIAR PROFISSIONAL
  contentAvaliarProfissional: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },

  tituloAvaliarProfissional: {
    fontSize: 18,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.4,
  },

  cartaoResumoAvaliacao: {
    backgroundColor: '#D9D9D9',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },

  infoResumoAvaliacao: {
    flex: 1,
  },

  textoResumoAvaliacao: {
    fontSize: 11,
    fontWeight: '500',
    color: '#111',
    lineHeight: 15,
    letterSpacing: 0.3,
  },

  tituloExperienciaAvaliacao: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.4,
  },

  subtituloCoracoesAvaliacao: {
    fontSize: 10,
    fontWeight: '400',
    color: '#4B5563',
    letterSpacing: 0.3,
    marginTop: 2,
    marginBottom: 10,
  },

  linhaCoracoesAvaliacao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 16,
  },

  tituloDestaqueAvaliacao: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.4,
    marginBottom: 10,
  },

  gradeDestaquesAvaliacao: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },

  pilulaDestaqueAvaliacao: {
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },

  pilulaDestaqueAtiva: {
    backgroundColor: '#7A9FB2',
  },

  pilulaDestaqueInativa: {
    backgroundColor: '#D9D9D9',
  },

  textoPilulaDestaque: {
    fontSize: 11,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.4,
  },

  labelRelatoAvaliacao: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.4,
    marginBottom: 8,
  },

  caixaRelatoAvaliacao: {
    backgroundColor: '#D9D9D9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 112,
    justifyContent: 'space-between',
  },

  inputRelatoAvaliacao: {
    fontSize: 12,
    color: '#111',
    minHeight: 74,
  },

  contadorRelatoAvaliacao: {
    alignSelf: 'flex-end',
    fontSize: 10,
    color: '#111',
    marginTop: 4,
  },

  ajudaRelatoAvaliacao: {
    fontSize: 10,
    color: '#4B5563',
    marginTop: 6,
    marginBottom: 16,
  },

  btnConcluirIndicacao: {
    backgroundColor: '#19D424',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnConcluirIndicacaoTexto: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  // TELA PROFISSIONAIS (LISTA PRINCIPAL)
  contentListaProfissionais: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },

  topoListaProfissionais: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  tituloListaProfissionais: {
    fontSize: 20,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  barraBuscaProfissionais: {
    backgroundColor: '#7A9FB2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },

  inputBuscaProfissionais: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
    paddingVertical: 0,
  },

  linhaFiltrosProfissionais: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 20,
  },

  pilulaFiltroProfissional: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  filtroTea: {
    backgroundColor: '#19D424',
  },

  filtroTdah: {
    backgroundColor: '#D9D9D9',
  },

  filtroTod: {
    backgroundColor: '#F3C767',
  },

  filtroProfissionalSelecionado: {
    borderWidth: 2,
    borderColor: '#111',
  },

  textoFiltroProfissional: {
    fontSize: 14,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  blocoProfissionalCatalogo: {
    marginBottom: 18,
  },

  linhaProfissionalCatalogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  btnSalvosListaProfissionais: {
    alignSelf: 'flex-end',
    backgroundColor: '#7A9FB2',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 22,
    marginTop: 4,
    marginBottom: 14,
  },

  btnSalvosListaProfissionaisTexto: {
    fontSize: 15,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  btnAdicionarIndicacoesLista: {
    backgroundColor: '#199E1F',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnAdicionarIndicacoesListaTexto: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  // TELA DETALHE PROFISSIONAL
  contentDetalheProfissional: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 24,
  },

  topoDetalheProfissional: {
    alignItems: 'center',
    marginBottom: 18,
  },

  badgeFolhaDetalhe: {
    position: 'absolute',
    right: 4,
    top: 28,
    width: 12,
    height: 8,
    borderRadius: 6,
    backgroundColor: '#000',
    transform: [{ rotate: '35deg' }],
  },

  balaoDetalheProfissional: {
    width: '54%',
    minWidth: 165,
    backgroundColor: '#D9D9D9',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
  },

  textoBalaoDetalhe: {
    fontSize: 11,
    fontWeight: '500',
    color: '#111',
    lineHeight: 15,
    letterSpacing: 0.3,
  },

  linhaCoracoesDetalhe: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },

  blocoSobreDetalhe: {
    backgroundColor: '#D9D9D9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 125,
    marginBottom: 16,
  },

  tituloSobreDetalhe: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111',
    marginBottom: 14,
  },

  textoSobreDetalhe: {
    fontSize: 12,
    fontWeight: '400',
    color: '#111',
    lineHeight: 17,
    paddingHorizontal: 14,
  },

  secaoRelatosDetalhe: {
    marginBottom: 22,
  },

  relatosHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  tituloRelatosDetalhe: {
    fontSize: 14,
    fontWeight: '400',
    color: '#111',
  },

  linkAdicionarRelato: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3E5C5B',
  },

  linhaNovoRelato: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },

  inputNovoRelato: {
    flex: 1,
    backgroundColor: '#EFECE2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: '#111',
  },

  btnConfirmarRelato: {
    backgroundColor: '#7A9FB2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  btnConfirmarRelatoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111',
  },

  pilulasRelatosColuna: {
    gap: 10,
  },

  pilulaRelatoAzul: {
    backgroundColor: '#7A9FB2',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },

  pilulaRelatoInativa: {
    opacity: 0.45,
  },

  textoPilulaRelato: {
    fontSize: 13,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  acoesDetalheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },

  btnSalvarDetalhe: {
    flex: 1,
    backgroundColor: '#199E1F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnSalvarDetalheTexto: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  btnCompartilharDetalhe: {
    flex: 1.35,
    backgroundColor: '#C5A55A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnCompartilharDetalheTexto: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  // TELA ADICIONAR PROFISSIONAIS E PROFISSIONAIS SALVOS
  scrollProfissionais: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  contentProfissionais: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 24,
  },

  contentProfissionaisSalvos: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 28,
  },

  tituloProfissionaisSalvos: {
    fontSize: 22,
    fontWeight: '400',
    color: '#111',
    textAlign: 'center',
    letterSpacing: 0.5,
    lineHeight: 28,
    marginBottom: 24,
    flex: 1,
  },

  blocoProfissionalSalvoItem: {
    marginBottom: 22,
  },

  linhaProfissionalSalvo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  btnSetaDetalheProfissional: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btnExcluirProfissionalSalvo: {
    marginTop: 10,
    alignSelf: 'flex-end',
    backgroundColor: '#B91C1C',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },

  btnExcluirProfissionalSalvoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },

  iconeProfissionalEsquerda: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  badgeFolhaProfissional: {
    position: 'absolute',
    right: 6,
    top: 26,
    width: 11,
    height: 7,
    borderRadius: 6,
    backgroundColor: '#000',
    transform: [{ rotate: '35deg' }],
  },

  balaoCinzaProfissional: {
    flex: 1,
    backgroundColor: '#D9D9D9',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },

  textoBalaoProfissional: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111',
    lineHeight: 16,
    letterSpacing: 0.3,
  },

  linhaCoracoesProfissional: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },

  btnAdicionarMaisProfissional: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#199E1F',
    borderRadius: 12,
    paddingVertical: 13,
  },

  btnAdicionarMaisProfissionalTexto: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    letterSpacing: 0.4,
  },

  headerVoltarProfissional: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },

  tituloAdicionarProfissionais: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.4,
  },

  campoProfissionalBox: {
    marginBottom: 12,
  },

  labelProfissional: {
    fontSize: 11,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  inputProfissionalCinza: {
    backgroundColor: '#D9D9D9',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
    color: '#111',
  },

  inputOutraEspecialidade: {
    marginTop: 6,
  },

  seletorEspecialidadeCinza: {
    backgroundColor: '#D9D9D9',
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  textoSeletorEspecialidade: {
    fontSize: 12,
    color: '#222',
    letterSpacing: 0.4,
  },

  textoSeletorSelecionado: {
    color: '#111',
    fontWeight: '600',
  },

  opcoesEspecialidadeLista: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 4,
  },

  opcaoEspecialidadeItem: {
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },

  opcaoEspecialidadeAtiva: {
    backgroundColor: '#DCFCE7',
  },

  opcaoEspecialidadeTexto: {
    fontSize: 12,
    color: '#111',
  },

  opcaoEspecialidadeTextoAtivo: {
    fontWeight: '700',
    color: '#166534',
  },

  areaSobreCinza: {
    backgroundColor: '#D9D9D9',
    minHeight: 160,
    padding: 10,
    justifyContent: 'space-between',
  },

  inputSobreMultiline: {
    fontSize: 12,
    color: '#111',
    minHeight: 120,
  },

  contadorCaracteres: {
    alignSelf: 'flex-end',
    fontSize: 11,
    color: '#111',
    marginTop: 4,
  },

  erroProfissionalTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B91C1C',
    marginBottom: 8,
  },

  btnProximoProfissional: {
    backgroundColor: '#199E1F',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },

  btnProximoProfissionalTexto: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  cartaoVazioProfissional: {
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: '#E2DDD0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },

  textoVazioProfissional: {
    fontSize: 13,
    color: '#555',
    lineHeight: 19,
    textAlign: 'center',
  },

  // TELA 1: HOME
  scrollHome: {
    flex: 1,
    backgroundColor: '#FAF7F5',
  },

  contentHome: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
  },

  subtitleHome: {
    textAlign: 'center',
    fontSize: 14,
    color: '#222',
    marginBottom: 14,
  },

  espacoSuperiorHome: {
    height: 110,
  },

  btnHomeVerdeClaro: {
    backgroundColor: '#5EE365',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  btnHomeAmareloClaro: {
    backgroundColor: '#F3C767',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  // TELA 2: BEM-VINDO! (MÃE ATÍPICA CADASTRADA)
  scrollBemVindo: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  contentBemVindo: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
  },

  tituloSejaBemVinda: {
    fontSize: 22,
    fontWeight: '400',
    color: '#111',
    textAlign: 'center',
    letterSpacing: 0.6,
    marginBottom: 14,
  },

  maesOnlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },

  maesOnlineTexto: {
    fontSize: 19,
    fontWeight: '400',
    color: '#111',
  },

  bolinhaOnline: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#000',
  },

  maesOnlineNumero: {
    fontSize: 19,
    fontWeight: '400',
    color: '#111',
  },

  btnAcaoAzul: {
    backgroundColor: '#7A9FB2',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  btnAcaoVerde: {
    backgroundColor: '#199E1F',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  btnAcaoOuro: {
    backgroundColor: '#C5A55A',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },

  btnAcaoTexto: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  acessoRapidoBox: {
    width: '100%',
  },

  acessoRapidoTitulo: {
    fontSize: 13,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  acessoRapidoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },

  quadradoAcessoRapido: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#D9D9D9',
    borderRadius: 14,
  },

  // TELA PERFIL
  scrollPerfil: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  contentPerfil: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 28,
  },

  perfilHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 22,
  },

  avatarCirculo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    borderColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },

  perfilSaudacaoBox: {
    flex: 1,
  },

  perfilSaudacaoTexto: {
    fontSize: 20,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.5,
  },

  perfilEmailTexto: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
  },

  perfilSubAnonimo: {
    fontSize: 12,
    color: '#2E7D32',
    marginTop: 4,
    fontWeight: '600',
  },

  btnCorrigirMae: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3E5C5B',
    backgroundColor: '#F5F5DC',
  },

  btnCorrigirMaeTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3E5C5B',
  },

  faixaFilhoEditar: {
    backgroundColor: '#C5A55A',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },

  faixaFilhoTexto: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#111',
    letterSpacing: 0.5,
  },

  faixaEditarTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    letterSpacing: 0.5,
  },

  blocoFilhosPerfil: {
    marginBottom: 22,
    gap: 10,
  },

  blocoFilhosTitulo: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3E5C5B',
    letterSpacing: 0.6,
  },

  semFilhosTexto: {
    fontSize: 13,
    color: '#666',
  },

  cartaoFilhoPerfil: {
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: '#E2DDD0',
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },

  cartaoFilhoNome: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },

  cartaoFilhoDetalhe: {
    fontSize: 12,
    color: '#444',
  },

  cartaoFilhoTags: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 2,
  },

  listaPerfilContainer: {
    gap: 18,
  },

  itemPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },

  itemPerfilTexto: {
    fontSize: 16,
    fontWeight: '400',
    color: '#111',
    letterSpacing: 0.6,
  },

  btnSairPerfil: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },

  btnSairPerfilTexto: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  btnExcluirPerfil: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#B91C1C',
  },

  btnExcluirPerfilTexto: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
    letterSpacing: 0.6,
  },

  caixaConfirmacaoExclusao: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },

  tituloConfirmacaoExclusao: {
    fontSize: 14,
    fontWeight: '700',
    color: '#991B1B',
  },

  textoConfirmacaoExclusao: {
    fontSize: 12,
    color: '#7F1D1D',
  },

  botoesConfirmacaoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },

  btnCancelarExclusao: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },

  btnCancelarExclusaoTexto: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  btnConfirmarExclusao: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#B91C1C',
  },

  btnConfirmarExclusaoTexto: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },

  // BARRA INFERIOR
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#D9D9D9',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
  },

  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  tabText: {
    fontSize: 11,
    color: '#111',
    marginTop: 2,
  },

  tabTextAtivo: {
    color: '#111',
    fontWeight: '600',
  },
});