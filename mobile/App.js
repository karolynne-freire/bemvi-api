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
  // 'inicio' | 'bem_vindo_mae' | 'apoio' | 'profissionais' | 'mapa' | 'perfil'
  const [abaHome, setAbaHome] = useState('inicio');
  const [editandoFilhosPeloPerfil, setEditandoFilhosPeloPerfil] = useState(false);

  // Controla se a mãe atípica realizou o cadastro e habilita a tela "BEM-VINDO!"
  const [cadastrouMaeAtipica, setCadastrouMaeAtipica] = useState(false);
  const [maesOnline] = useState(12);

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

  // Estado do modo anônimo no perfil
  const [modoAnonimo, setModoAnonimo] = useState(false);

  const persistirDadosPerfil = async (
    listaFilhos = filhos,
    nomeMae = nome,
    anonimo = modoAnonimo,
    cadastroMae = cadastrouMaeAtipica,
    uidOverride = null
  ) => {
    try {
      const uid = uidOverride || auth.currentUser?.uid || 'convidado';
      const payload = {
        nome: (nomeMae || '').trim(),
        filhos: listaFilhos,
        modoAnonimo: Boolean(anonimo),
        cadastrouMaeAtipica: Boolean(cadastroMae),
        atualizadoEm: new Date().toISOString(),
      };
      await AsyncStorage.setItem(getChavePerfilUsuario(uid), JSON.stringify(payload));
    } catch (err) {
      console.log('Erro ao salvar dados do perfil:', err);
    }
  };

  const limparEstadoSessao = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setMostrarSenha(false);
    setAvisoNaoCadastrado('');
    setModoAnonimo(false);
    setCadastrouMaeAtipica(false);
    setEditandoFilhosPeloPerfil(false);
    setPedirConfirmacaoExclusao(false);
    setFilhos([criarFilhoVazio()]);
    setAbaHome('inicio');
    setTelaAtual('welcome');
  };

  useEffect(() => {
    const subscriber = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const salvo = await AsyncStorage.getItem(getChavePerfilUsuario(user.uid));
          if (salvo) {
            const dados = JSON.parse(salvo);
            if (dados.nome) setNome(dados.nome);
            if (typeof dados.modoAnonimo === 'boolean') setModoAnonimo(dados.modoAnonimo);
            if (typeof dados.cadastrouMaeAtipica === 'boolean') {
              setCadastrouMaeAtipica(dados.cadastrouMaeAtipica);
            }
            if (Array.isArray(dados.filhos) && dados.filhos.length > 0) {
              setFilhos(dados.filhos);
            }
          }
          if (user.email) setEmail(user.email);
          if (user.displayName && !nome) setNome(user.displayName);
        } catch (err) {
          console.log('Erro ao carregar dados do perfil:', err);
        }

        setTelaAtual((prev) =>
          prev === 'cadastro_filhos' || prev === 'editar_mae' || prev === 'perfil_excluido'
            ? prev
            : 'home'
        );
      } else {
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
        cadastrouMaeAtipica
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
    await persistirDadosPerfil(filhos, nome, valor, cadastrouMaeAtipica);
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
      let abrirBemVindo = false;

      try {
        const salvo = await AsyncStorage.getItem(getChavePerfilUsuario(cred.user.uid));
        if (salvo) {
          const dados = JSON.parse(salvo);
          if (dados.nome) setNome(dados.nome);
          if (typeof dados.modoAnonimo === 'boolean') setModoAnonimo(dados.modoAnonimo);
          if (typeof dados.cadastrouMaeAtipica === 'boolean') {
            setCadastrouMaeAtipica(dados.cadastrouMaeAtipica);
            abrirBemVindo = dados.cadastrouMaeAtipica;
          }
          if (Array.isArray(dados.filhos) && dados.filhos.length > 0) {
            setFilhos(dados.filhos);
          }
        }
      } catch (err) {
        console.log('Erro ao ler perfil no login:', err);
      }

      setAvisoNaoCadastrado('');
      setAbaHome(abrirBemVindo ? 'bem_vindo_mae' : 'inicio');
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
      setFilhos(filhosIniciais);
      setEditandoFilhosPeloPerfil(false);
      setAvisoNaoCadastrado('');

      await persistirDadosPerfil(
        filhosIniciais,
        nomeLimpo,
        modoAnonimo,
        true,
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
    await persistirDadosPerfil(dadosFormatados, nome, modoAnonimo, cadastrouMaeAtipica);

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

  // TELA 3: HOME / BEM-VINDO! / PERFIL
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

  const mostrarTelaBemVindoMae = abaHome === 'bem_vindo_mae' && cadastrouMaeAtipica;

  return (
    <SafeAreaView style={styles.containerHome}>
      {/* Cabeçalho */}
      <View style={styles.headerHome}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Menu Bemvi',
              `Você está em: ${abaHome.toUpperCase()}${modoAnonimo ? ' (Modo Anônimo ativo)' : ''}`
            )
          }
        >
          <Ionicons name="menu-outline" size={28} color="#111" />
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

      {abaHome === 'perfil' ? (
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
        // TELA "BEM-VINDO!" (SÓ APARECE QUANDO A MÃE ATÍPICA SE CADASTROU)
        <ScrollView
          style={styles.scrollBemVindo}
          contentContainerStyle={styles.contentBemVindo}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.tituloSejaBemVinda}>SEJA BEM VINDA!</Text>

          <View style={styles.maesOnlineRow}>
            <Text style={styles.maesOnlineTexto}>Mães Online</Text>
            <View style={styles.bolinhaOnline} />
            <Text style={styles.maesOnlineNumero}>{maesOnline}</Text>
          </View>

          <TouchableOpacity
            style={styles.btnAcaoAzul}
            onPress={() => setAbaHome('apoio')}
          >
            <Text style={styles.btnAcaoTexto}>PRECISO CONVERSAR</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnAcaoVerde}
            onPress={() => setAbaHome('profissionais')}
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
            onPress={() => setAbaHome('profissionais')}
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
          onPress={() => setAbaHome('profissionais')}
        >
          <Ionicons
            name="briefcase"
            size={24}
            color={abaHome === 'profissionais' ? '#16A34A' : '#111'}
          />
          <Text style={[styles.tabText, abaHome === 'profissionais' && styles.tabTextAtivo]}>
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